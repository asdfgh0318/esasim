import * as THREE from "three";
import { Client } from "@colyseus/sdk";
import { buildField } from "./field.js";
import { createPlane as createSimPlane } from "../shared/plane.js";
import { Streamer } from "../shared/streamer.js";
import { toParams } from "../shared/workshop.js";
import { FIELD, pitX } from "../shared/rules.js";
import { windAt } from "../shared/wind.js";
import { RadioInput } from "./input/radio.js";
import { mountRadioUI } from "./input/radioUI.js";
import { StreamerView } from "./streamerView.js";
import { CameraRig } from "./camera.js";
import { mountHud } from "./hud.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { makeSky, loadHdrSky } from "./sky.js";
import { createOrientationWidget } from "./orientation.js";
import { FpvShader } from "./fpvEffect.js";
import { signalQuality, interference, CHANNELS } from "../shared/vtx.js";
import { loadBuild, saveBuild, mountWorkshop } from "./workshop.js";
import { mountPhysicsPanel } from "./physicsPanel.js";
import { createPlane, setTint, spinProp, PLANE_TYPES, PLANE_NAMES } from "./planeModel.js";

const params = new URLSearchParams(location.search);
const scene = new THREE.Scene();
scene.background = makeSky(); loadHdrSky(scene);          // procedural sky at once, the CC0 HDR sky replaces it when loaded
scene.fog = new THREE.Fog(0xc0dcf0, 150, 650);            // haze matches the sky at the horizon
scene.add(new THREE.HemisphereLight(0xffffff, 0x446644, 1.2), buildField());
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.append(renderer.domElement);
const composer = new EffectComposer(renderer), fpvPass = new ShaderPass(FpvShader);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(fpvPass); composer.addPass(new OutputPass());
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

const COLORS = [0xd23b3b, 0x3b6bd2, 0x2aa84a, 0xe0b000, 0x9b4bd0, 0x22b8c4, 0xe07a30];   // pilot colours by start box (tail and spinner)
const build = loadBuild();
if (PLANE_TYPES.includes(params.get("plane"))) build.plane = params.get("plane");
const planeType = build.plane;
const simParams = toParams(build);                       // the pilot's workshop build; the server validates it (ESA §3, §6)

// ---- state ----
const sim = createSimPlane(simParams);
let me = { id: null, pit: 3 };
let phase = "lobby", snapNames = new Map(), online = false;
const myMesh = createPlane(planeType, COLORS[me.pit], { spanMm: build.spanMm }); scene.add(myMesh);
const orient = createOrientationWidget(planeType, COLORS[me.pit]);
const others = new Map(), views = new Map();   // id -> { mesh, pos, quat } / StreamerView
const localStreamer = new Streamer({ seed: 9 }); // offline only
const rig = new CameraRig(camera);
const radio = new RadioInput(), updateRadioUI = mountRadioUI(radio);
const keys = new Set();
let room = null, landedAt = -1, kbThrottle = 0, myVtx = { mw: build.vtxMw || 25, ch: Math.max(0, build.vtxCh) };
const feedB = new THREE.WebGLRenderTarget(640, 360), camB = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1500);   // another pilot's video feed
// Flight recorder (ESA §4.19: protests are decided by vote, so a replay is the evidence): snapshots and events of the last fight.
let rec = [], recT0 = 0, replay = null, recPhase = "";

const hud = mountHud({
  ready: (v) => room?.send("ready", v), addBot: () => room?.send("addBot"), removeBots: () => room?.send("removeBots"), start: () => room?.send("start"),
  plane: (t) => { saveBuild({ ...build, plane: t }); const u = new URLSearchParams(location.search); u.set("plane", t); location.search = u.toString(); },
  workshop: () => workshop.toggle(),
  vtx: (mw, ch) => setVtx(mw, ch),
  replay: () => (replay ? stopReplay() : startReplay()), saveReplay: () => saveReplay(),
}, { types: PLANE_TYPES, names: PLANE_NAMES, current: planeType });
const workshop = mountWorkshop(PLANE_TYPES, PLANE_NAMES, build);
mountPhysicsPanel(build, (b) => { saveBuild(b); location.reload(); });          // advanced physics editor (PicaSim-style parameters)

function home() {                                  // plane back in the pilot's hand at the start box (ESA §4.4, §4.6)
  sim.pos.set(pitX(me.pit), 1.4, FIELD.pilotLineZ); sim.vel.set(0, 0, 0); sim.quat.identity(); sim.omega.set(0, 0, 0);
  sim.held = true; sim.onGround = false; sim.input.throttle = 0; kbThrottle = 0; landedAt = -1; sim.refuel();
  localStreamer.reset([sim.pos.x, sim.pos.y, sim.pos.z + simParams.tailZ]);
}
home();
const canLaunch = () => sim.held && (!online || phase === "lobby" || phase === "prep" || phase === "flight");   // §4.2: no launches in readiness
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();       // a focused button must not swallow Space
  if (e.code === "Space") { if (canLaunch()) { if (!radio.connected) kbThrottle = 1; sim.launch(); hud.toast(radio.connected ? "Launched" : "Launched at full throttle (Ctrl to reduce)"); } else if (sim.held) hud.toast("Not now: launch is allowed in the flight part (§4.2.3)"); }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());                               // no stuck keys after switching windows
document.addEventListener("click", (e) => { if (e.target.closest?.("button")) e.target.blur?.(); });   // keep the keyboard on the game

// ---- video transmitter, switchable live like the power switch at the pits (only with the model in the hand) ----
function setVtx(mw, ch) {
  if (!sim.held) { hud.toast("Change the video transmitter with the model in your hand"); hud.setVtx(myVtx.mw, myVtx.ch); return; }
  myVtx = { mw, ch: ch < 0 ? myVtx.ch : ch };                                           // auto keeps the channel the arena picked
  saveBuild({ ...build, vtxMw: mw, vtxCh: ch });
  room?.send("vtx", { mw, ch });
}

// ---- recorder and replay ----
const pendingEvents = [];
function record(snap) {
  const ph = snap.fight.phase;
  if (ph === "flight" && recPhase !== "flight" && recPhase !== "ended") { rec = []; recT0 = performance.now(); }   // a new flight starts: forget the last one
  if (ph === "flight" || ph === "ended") { if (rec.length % 1 === 0) rec.push({ t: performance.now() - recT0, snap, events: pendingEvents.splice(0) }); }
  else pendingEvents.length = 0;
  recPhase = ph;
}
function startReplay() {
  if (!rec.length) return;
  replay = { i: 0, t0: performance.now() }; myMesh.visible = false;
  for (const [, o] of others) scene.remove(o.mesh); others.clear();
  for (const [, v] of views) v.dispose(); views.clear();
  hud.toast("Replay"); hud.replayBar(true, true);
}
function stopReplay() {
  replay = null; myMesh.visible = true;
  for (const [, o] of others) scene.remove(o.mesh); others.clear();
  for (const [, v] of views) v.dispose(); views.clear();
  hud.replayBar(phase === "results" && rec.length > 0, false);
}
function saveReplay() {
  const blob = new Blob([JSON.stringify({ game: "ESASIM", rules: "ESA 2024", frames: rec.map((r) => ({ t: Math.round(r.t), fight: r.snap.fight, series: r.snap.series, planes: r.snap.planes, events: r.events })) })], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `esasim-replay-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json` });
  a.click(); URL.revokeObjectURL(a.href);
}

// ---- network ----
const nm = (id) => snapNames.get(id) || "?";
function onEvent(e, fromReplay = false) {
  if (replay && !fromReplay) return;
  const mine = e.id === me.id;
  if (e.type === "cut") hud.toast(`${nm(e.id)} cut ${nm(e.victim)}'s streamer  +${e.pts}`, mine ? "good" : e.victim === me.id ? "bad" : "");
  else if (e.type === "safety") hud.toast(`${nm(e.id)} crossed the safety line  ${e.pts}`, "bad");
  else if (e.type === "disqualified") hud.toast(`${nm(e.id)} disqualified: second crossing (§4.9)`, "bad");
  else if (e.type === "warning" && mine) hud.toast("Non-engagement warning: go fight (§4.14)", "bad");
  else if (e.type === "non-engagement") hud.toast(`${nm(e.id)} non-engagement  ${e.pts}`, "bad");
  else if (e.type === "landing-bonus") hud.toast(`${nm(e.id)} landed in the field  +${e.pts}`, "good");
  else if (e.type === "protected") hud.toast(`${nm(e.id)} kept the streamer  +${e.pts}`, "good");
  else if (e.type === "phase" && e.phase === "flight") hud.toast("FLIGHT!", "good");
  else if (e.type === "phase" && e.phase === "ended") hud.toast("Flight over: land now", "");
}
function onSnap(snap, fromReplay = false) {
  if (replay && !fromReplay) return;
  if (!fromReplay) record(snap);
  phase = snap.fight.phase;
  snapNames = new Map(snap.fight.pilots.map((p) => [p.id, p.name]));
  hud.update(snap, me.id);
  if (!replay) hud.replayBar(phase === "results" && rec.length > 0, false);
  const seen = new Set();
  for (const p of snap.planes) {
    seen.add(p.id);
    let v = views.get(p.id);
    if (!v) { v = new StreamerView(scene, COLORS[p.pit % 7]); views.set(p.id, v); }
    v.update(p.streamer);
    if (p.id === me.id && p.vtxMw) { myVtx = { mw: p.vtxMw, ch: p.vtxCh }; hud.setVtx(myVtx.mw, myVtx.ch); }
    if (p.id === me.id && !fromReplay) { if (others.has(me.id)) { scene.remove(others.get(me.id).mesh); others.delete(me.id); } continue; }
    let o = others.get(p.id);
    if (!o) { o = { mesh: createPlane(p.plane, COLORS[p.pit % 7], { spanMm: p.spanMm }), pos: new THREE.Vector3(...p.pos), quat: new THREE.Quaternion(), air: false, vtx: { mw: 25, ch: 0 } }; o.mesh.position.copy(o.pos); scene.add(o.mesh); others.set(p.id, o); }
    o.pos.set(...p.pos); o.air = p.airborne; o.vtx = { mw: p.vtxMw || 25, ch: p.vtxCh ?? 0 };
    const z = new THREE.Vector3(...p.fwd), x = new THREE.Vector3(...p.right), y = new THREE.Vector3().crossVectors(z, x);
    o.quat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  for (const [id, o] of others) if (!seen.has(id)) { scene.remove(o.mesh); others.delete(id); }
  for (const [id, v] of views) if (!seen.has(id)) { v.dispose(); views.delete(id); }
}
new Client(`ws://${params.get("server") || location.hostname}:2567`).joinOrCreate("combat", { name: params.get("name") || "Pilot", plane: planeType, build }).then((r) => {
  room = r; online = true;
  r.onMessage("you", (y) => { me = y; rig.setPit(y.pit); setTint(myMesh, COLORS[y.pit % 7]); if (sim.held) home(); });
  r.onMessage("snap", (sn) => onSnap(sn)); r.onMessage("events", (ev) => { if (!replay) pendingEvents.push(...ev); ev.forEach((e) => onEvent(e)); });
  r.onMessage("restart", () => { home(); hud.toast("New fight"); });
  if (params.get("bots")) for (let i = 0; i < Number(params.get("bots")); i++) r.send("addBot");   // debug helpers for screenshots/tests
  if (params.has("autostart")) setTimeout(() => { r.send("ready", true); r.send("start"); }, 500);
}).catch(() => { console.warn("no server: offline practice"); hud.offline(); });

// ---- loop ----
const STEP = 1 / 240;
let last = performance.now(), acc = 0, sent = 0;
renderer.setAnimationLoop((t) => {
  const frame = Math.min((t - last) / 1000, 0.1); last = t; acc += frame;
  if (replay) {
    const rt = t - replay.t0;
    while (replay.i < rec.length && rec[replay.i].t <= rt) { const r = rec[replay.i++]; onSnap(r.snap, true); r.events.forEach((e) => onEvent(e, true)); }
    if (replay.i >= rec.length && rt > (rec[rec.length - 1]?.t ?? 0) + 2000) stopReplay();
  }
  const k = (c) => (keys.has(c) ? 1 : 0);
  if (radio.poll()) Object.assign(sim.input, radio.channels);
  else {                                          // keyboard, same layout as the author's drone sim: WASD pitch/roll, Q/E yaw, Shift/Ctrl throttle (arrows also pitch/roll)
    kbThrottle = THREE.MathUtils.clamp(kbThrottle + ((k("ShiftLeft") || k("ShiftRight")) - (k("ControlLeft") || k("ControlRight"))) * 0.5 * frame, 0, 1);
    sim.input.throttle = kbThrottle;
    sim.input.elevator = (k("KeyS") || k("ArrowDown")) - (k("KeyW") || k("ArrowUp"));     // W/up = stick forward = nose down
    sim.input.aileron = (k("KeyD") || k("ArrowRight")) - (k("KeyA") || k("ArrowLeft"));
    sim.input.rudder = k("KeyE") - k("KeyQ");
  }
  sim.wind.set(...windAt(t / 1000, sim.pos.x, sim.pos.z));
  while (acc >= STEP) { sim.step(STEP); acc -= STEP; }
  const airborne = !sim.held && !sim.onGround && sim.pos.y > 0.2;
  if (!sim.held && !airborne && landedAt < 0) landedAt = t;                          // touchdown: fetch the model after a moment
  if (landedAt >= 0 && t - landedAt > 4000) home();
  myMesh.position.copy(sim.pos); myMesh.quaternion.copy(sim.quat);
  spinProp(myMesh, sim.held ? 0 : 60 + sim.input.throttle * 500, frame);
  for (const o of others.values()) { o.mesh.position.lerp(o.pos, 1 - Math.exp(-14 * frame)); o.mesh.quaternion.slerp(o.quat, 1 - Math.exp(-14 * frame)); spinProp(o.mesh, o.air ? 420 : 0, frame); }
  if (!online) {                                                                     // offline: draw my own streamer locally
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(sim.quat);
    localStreamer.push([sim.pos.x + f.x * simParams.tailZ, sim.pos.y + f.y * simParams.tailZ, sim.pos.z + f.z * simParams.tailZ]);
    let v = views.get("local"); if (!v) { v = new StreamerView(scene, COLORS[me.pit]); views.set("local", v); }
    v.update(localStreamer.points(t / 1000).flat());
  }
  if (params.has("top")) { camera.position.set(0, 90, 15); camera.lookAt(0, 0, 15); camera.fov = 55; camera.updateProjectionMatrix(); } else {
    let focus = sim.pos;
    if ((sim.held || replay) && others.size) {                                           // own model still in the hand: watch the airborne plane nearest to the middle of the action
      const air = [...others.values()].filter((o) => o.pos.y > 1);
      if (air.length) { const c = new THREE.Vector3(); air.forEach((o) => c.add(o.pos)); c.divideScalar(air.length); focus = air.reduce((best, o) => (o.pos.distanceTo(c) < best.pos.distanceTo(c) ? o : best)).mesh.position; }
    }
    rig.update(sim, frame, focus);
  }
  if (room && t - sent > 50) {
    sent = t;
    room.send("pose", { pos: sim.pos.toArray(), quat: sim.quat.toArray(), vel: sim.vel.toArray(), airborne, held: sim.held });
  }
  hud.battery(sim.battery01, sim.energyWh <= 0); hud.vtxEnabled(sim.held);
  updateRadioUI();
  // Analog FPV: the link degrades with distance from the pilot (ESASIM-specific effect, see client/fpvEffect.js)
  if (replay && rig.mode === "fpv") rig.mode = "pilot";
  if (rig.mode === "fpv") {
    const rx = pitX(me.pit), ry = 1.7, rz = FIELD.pilotLineZ - 0.8;                    // my receiver, at my start box
    const dMe = Math.hypot(sim.pos.x - rx, sim.pos.y - ry, sim.pos.z - rz);
    const q = signalQuality(dMe, myVtx.mw);
    const air = []; for (const [id, o] of others) if (o.air) air.push({ id, mw: o.vtx.mw, ch: o.vtx.ch, d: Math.hypot(o.mesh.position.x - rx, o.mesh.position.y - ry, o.mesh.position.z - rz) });
    const inter = interference(myVtx, dMe, air);
    let level = 0, info = null;
    const src = inter.source && inter.level > 0.1 ? others.get(inter.source) : null;
    if (src) {                                                                         // render the interfering pilot's nose camera into the second feed
      level = inter.level; info = { level, name: snapNames.get(inter.source) || "?", ch: CHANNELS[src.vtx.ch] || "?", mw: src.vtx.mw };
      const m = src.mesh;
      camB.position.copy(m.position).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(m.quaternion), 0.31).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(m.quaternion), 0.03);
      camB.quaternion.copy(m.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      renderer.setRenderTarget(feedB); renderer.render(scene, camB); renderer.setRenderTarget(null);
    }
    fpvPass.uniforms.noise.value = Math.max(1 - q, level * 0.35); fpvPass.uniforms.interf.value = level; fpvPass.uniforms.tFeedB.value = feedB.texture;
    fpvPass.uniforms.time.value = t / 1000; fpvPass.uniforms.aspect.value = innerWidth / innerHeight;
    hud.vtx(q, info); fpvPass.enabled = true; composer.render();
  } else { hud.vtx(null); renderer.render(scene, camera); }
  // beginner orientation widget: the plane as seen from the pilot's eyes at the start box
  hud.orient(orient.update(new THREE.Vector3(pitX(me.pit), 1.7, FIELD.pilotLineZ - 0.8), sim.pos, sim.quat));
  orient.render(renderer);
});
