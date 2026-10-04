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
import { t } from "./i18n.js";
import { sound } from "./sound.js";
import { createVoice } from "./voice.js";
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
const strict = params.has("strict");                       // contest room (?strict): no advanced physics edits
const build = loadBuild();
if (strict) delete build.paramOverrides;
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
const localStreamer = new Streamer({ seed: 9 }); // my own streamer, drawn locally (the server only trims it when someone cuts it)
const rig = new CameraRig(camera);
const radio = new RadioInput(), updateRadioUI = mountRadioUI(radio);
const keys = new Set();
let windOffset = 0;
const kbStick = { aileron: 0, elevator: 0, rudder: 0 };
const ramp = (cur, target, dt) => { const step = (target === 0 ? 6.5 : 3.3) * dt, d = target - cur; return Math.abs(d) <= step ? target : cur + Math.sign(d) * step; };
const expo = (v) => Math.sign(v) * (0.4 * Math.abs(v) + 0.6 * Math.abs(v) ** 3);                  // 0.5 stick -> 0.275, full stick -> 1
let room = null, landedAt = -1, kbThrottle = 0, myVtx = { mw: build.vtxMw || 25, ch: Math.max(0, build.vtxCh) };
const feedB = new THREE.WebGLRenderTarget(640, 360), camB = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1500);   // another pilot's video feed
// Flight recorder (ESA §4.19: protests are decided by vote, so a replay is the evidence): snapshots and events of the last fight.
let rec = [], recT0 = 0, replay = null, recPhase = "";

const hud = mountHud({
  ready: (v) => room?.send("ready", v), addBot: (level) => room?.send("addBot", { level }), removeBots: () => room?.send("removeBots"), start: () => room?.send("start"),
  plane: (t) => { saveBuild({ ...build, plane: t }); const u = new URLSearchParams(location.search); u.set("plane", t); location.search = u.toString(); },
  workshop: () => workshop.toggle(),
  voice: () => voice?.cycle(),
  invite: () => {                                                                   // private room: first click opens a new code, in a room the click copies the invite link
    if (!roomCode) { const u = new URLSearchParams(location.search); u.set("room", Math.random().toString(36).slice(2, 6).toUpperCase()); location.search = u.toString(); return; }
    const link = `${location.origin}${location.pathname}?room=${roomCode}`;
    (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => hud.toast(t("toast.copied") + link, "good")).catch(() => hud.toast(t("toast.link") + link));
  },
  vtx: (mw, ch) => setVtx(mw, ch),
  replay: () => (replay ? stopReplay() : startReplay()), saveReplay: () => saveReplay(),
}, { types: PLANE_TYPES, names: PLANE_NAMES, current: planeType });
const workshop = mountWorkshop(PLANE_TYPES, PLANE_NAMES, build);
if (strict) { const adv = document.getElementById("ws-adv"); if (adv) adv.style.display = "none"; }
if (!strict) mountPhysicsPanel(build, (b) => { saveBuild(b); location.reload(); });          // advanced physics editor (PicaSim-style parameters)

function home() {                                  // plane back in the pilot's hand at the start box (ESA §4.4, §4.6)
  sim.pos.set(pitX(me.pit), 1.4, FIELD.pilotLineZ); sim.vel.set(0, 0, 0); sim.quat.identity(); sim.omega.set(0, 0, 0);
  sim.held = true; sim.onGround = false; sim.input.throttle = 0; kbThrottle = 0; landedAt = -1; sim.refuel();
  localStreamer.reset([sim.pos.x, sim.pos.y, sim.pos.z + simParams.tailZ]);
}
home();
let meDq = false;                                                                  // §4.9: disqualified for the rest of the contest
const canLaunch = () => sim.held && !meDq && (!online || phase === "lobby" || phase === "prep" || phase === "flight");   // §4.2: no launches in readiness
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();       // a focused button must not swallow Space
  if (e.code === "Space") { if (canLaunch()) { if (!radio.connected) kbThrottle = 1; sim.launch(); hud.toast(radio.connected ? t("launched") : t("launchedFull")); } else if (sim.held) hud.toast(t("notNow")); }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());                               // no stuck keys after switching windows
document.addEventListener("click", (e) => { if (e.target.closest?.("button")) e.target.blur?.(); });   // keep the keyboard on the game

// ---- video transmitter, switchable live like the power switch at the pits (only with the model in the hand) ----
function setVtx(mw, ch) {
  if (!sim.held) { hud.toast(t("vtxHand")); hud.setVtx(myVtx.mw, myVtx.ch); return; }
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
  hud.toast(t("replay")); hud.replayBar(true, true);
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
// ?server=HOST (port 2567), or a full ws:// / wss:// URL (needed behind a tunnel); default: the host that served this page (same port when the game server serves the page, port 2567 next to the Vite dev server).
function serverUrl() {
  const s = params.get("server");
  if (s && /^wss?:\/\//.test(s)) return s;
  if (!s && location.port !== "5173" && location.port !== "") return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;   // page served by the game server itself (npm run play): same port
  return `${location.protocol === "https:" ? "wss" : "ws"}://${s || location.hostname}${s && s.includes(":") ? "" : ":2567"}`;
}
const nm = (id) => snapNames.get(id) || "?";
function onEvent(e, fromReplay = false) {
  if (replay && !fromReplay) return;
  const mine = e.id === me.id;
  if (e.type === "cut") sound.cut(); else if (e.type === "safety") sound.buzzer(); else if (e.type === "phase" && (e.phase === "flight" || e.phase === "ended")) sound.whistle();
  if (e.type === "cut") hud.toast(t("ev.cut", { a: nm(e.id), b: nm(e.victim), p: e.pts }), mine ? "good" : e.victim === me.id ? "bad" : "");
  else if (e.type === "safety") hud.toast(t("ev.safety", { a: nm(e.id), p: e.pts }), "bad");
  else if (e.type === "disqualified") hud.toast(t("ev.dq", { a: nm(e.id) }), "bad");
  else if (e.type === "warning" && mine) hud.toast(t("ev.warn"), "bad");
  else if (e.type === "non-engagement") hud.toast(t("ev.non", { a: nm(e.id), p: e.pts }), "bad");
  else if (e.type === "landing-bonus") hud.toast(t("ev.land", { a: nm(e.id), p: e.pts }), "good");
  else if (e.type === "protected") hud.toast(t("ev.prot", { a: nm(e.id), p: e.pts }), "good");
  else if (e.type === "phase" && e.phase === "flight") hud.toast(t("ev.flight"), "good");
  else if (e.type === "phase" && e.phase === "ended") hud.toast(t("ev.over"), "");
}
function onSnap(snap, fromReplay = false) {
  if (replay && !fromReplay) return;
  if (!fromReplay) record(snap);
  phase = snap.fight.phase;
  if (!fromReplay && snap.t !== undefined) windOffset = snap.t - performance.now() / 1000;   // same wind as the server and the bots (N9)
  meDq = !!snap.fight.pilots.find((p) => p.id === me.id)?.disqualified;
  snapNames = new Map(snap.fight.pilots.map((p) => [p.id, p.name]));
  hud.update(snap, me.id);
  if (!replay) hud.replayBar(phase === "results" && rec.length > 0, false);
  const mine = snap.planes.find((p) => p.id === me.id);
  if (mine && mine.vtxMw) { myVtx = { mw: mine.vtxMw, ch: mine.vtxCh }; hud.setVtx(myVtx.mw, myVtx.ch); }
  if (fromReplay) { applyPlanes(snap.planes, true); return; }
  if (mine) {                                                                          // own streamer is drawn locally (no network lag); the server only tells me when it was cut
    let len = 0; for (let i = 3; i + 2 < mine.streamer.length; i += 3) len += Math.hypot(mine.streamer[i] - mine.streamer[i - 3], mine.streamer[i + 1] - mine.streamer[i - 2], mine.streamer[i + 2] - mine.streamer[i - 1]);
    if (mine.streamer.length >= 6 && len < localStreamer.length - 0.4) localStreamer.cut(len);
  }
  humanIds = snap.fight.pilots.filter((p) => !p.bot).map((p) => p.id);
  voice?.sync();
  snapBuf.push({ t: performance.now(), planes: snap.planes }); if (snapBuf.length > 12) snapBuf.shift();
}
// Remote planes and their streamers are shown INTERP_MS in the past, interpolated between the two snapshots around that moment, so mesh and
// ribbon move smoothly and stay together (the server sends about 15 snapshots a second).
const INTERP_MS = 100, snapBuf = [];
function interpolated(now) {
  const target = now - INTERP_MS;
  if (!snapBuf.length) return null;
  let i = snapBuf.length - 1; while (i > 0 && snapBuf[i - 1].t > target) i--;
  const b = snapBuf[i], a = snapBuf[Math.max(0, i - 1)];
  if (a === b || target >= b.t) return b.planes;
  if (target <= a.t) return a.planes;
  const f = (target - a.t) / (b.t - a.t), lerp3 = (x, y) => x.map((v, k) => v + (y[k] - v) * f);
  return b.planes.map((pb) => {
    const pa = a.planes.find((q) => q.id === pb.id); if (!pa) return pb;
    return { ...pb, pos: lerp3(pa.pos, pb.pos), fwd: lerp3(pa.fwd, pb.fwd), right: lerp3(pa.right, pb.right), streamer: pa.streamer.length === pb.streamer.length ? lerp3(pa.streamer, pb.streamer) : pb.streamer };
  });
}
function applyPlanes(planes, fromReplay = false) {
  const seen = new Set();
  for (const p of planes) {
    seen.add(p.id);
    if (p.id === me.id && !fromReplay) { if (others.has(me.id)) { scene.remove(others.get(me.id).mesh); others.delete(me.id); } continue; }
    let v = views.get(p.id);
    if (!v) { v = new StreamerView(scene, COLORS[p.pit % 7]); views.set(p.id, v); }
    v.update(p.streamer);
    let o = others.get(p.id);
    if (!o) { o = { mesh: createPlane(p.plane, COLORS[p.pit % 7], { spanMm: p.spanMm }), pos: new THREE.Vector3(...p.pos), quat: new THREE.Quaternion(), air: false, vtx: { mw: 25, ch: 0 } }; o.mesh.position.copy(o.pos); scene.add(o.mesh); others.set(p.id, o); }
    o.pos.set(...p.pos); o.air = p.airborne; o.vtx = { mw: p.vtxMw || 25, ch: p.vtxCh ?? 0 };
    const z = new THREE.Vector3(...p.fwd), x = new THREE.Vector3(...p.right), y = new THREE.Vector3().crossVectors(z, x);
    o.quat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  for (const [id, o] of others) if (!seen.has(id)) { scene.remove(o.mesh); others.delete(id); }
  for (const [id, v] of views) if (!seen.has(id) && id !== "local") { v.dispose(); views.delete(id); }
}
// Stable pilot id per browser tab (sessionStorage: survives a reload, two tabs stay two pilots) and an optional private room code (?room=ABCD).
const pid = (() => { try { let v = sessionStorage.getItem("esasim-pid"); if (!v) { v = Math.random().toString(36).slice(2, 12); sessionStorage.setItem("esasim-pid", v); } return v; } catch { return Math.random().toString(36).slice(2, 12); } })();
const roomCode = (params.get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
{ const bi = document.getElementById("b-invite"); if (bi) bi.textContent = roomCode ? t("inviteCopy") : t("invite"); }
const joinOptions = () => ({ name: params.get("name") || "Pilot", plane: planeType, build, pid, code: roomCode, strict });
// Voice chat only in private rooms (?room=CODE): opt-in, peer to peer, see client/voice.js.
let humanIds = [];
const voice = roomCode ? createVoice({ send: (m) => room?.send("rtc", m), myId: () => me.id, humans: () => humanIds, onSpeaking: (s) => hud.setSpeaking(s), onMode: (m, e) => { hud.voiceMode(m); if (e) console.warn("voice:", e); }, stun: params.has("stun") }) : null;
if (voice) hud.voiceAvailable(true);
window.__voice = voice;                                                                 // for tests
function attach(r) {
  room = r; online = true;
  r.onMessage("you", (y) => { me = y; rig.setPit(y.pit); setTint(myMesh, COLORS[y.pit % 7]); if (sim.held) home(); });
  r.onMessage("snap", (sn) => onSnap(sn)); r.onMessage("events", (ev) => { if (!replay) pendingEvents.push(...ev); ev.forEach((e) => onEvent(e)); });
  r.onMessage("restart", () => { home(); hud.toast(t("toast.newFight")); });
  r.onMessage("ping", (n) => r.send("pong", n));
  r.onMessage("rtc", (m) => voice?.onSignal(m.from, m.data));                                     // server measures the round trip for lag-compensated cuts (docs/netcode.md)
  r.onMessage("full", () => { online = false; room = null; hud.toast(t("toast.full")); hud.offline(); });
  r.onLeave((code) => {                                                              // dropped connection: try to come back to the same box within 30 s (the server keeps it)
    if (room !== r) return;
    room = null;
    if (code === 4000) return;
    hud.toast(t("toast.lost"), "bad"); retry(Date.now());
  });
}
function retry(t0) {
  if (Date.now() - t0 > 30000) { online = false; hud.toast(t("toast.noReconnect"), "bad"); hud.offline(); return; }
  new Client(serverUrl()).joinOrCreate("combat", joinOptions()).then((r) => { attach(r); hud.toast(t("toast.back"), "good"); }).catch(() => setTimeout(() => retry(t0), 2000));
}
new Client(serverUrl()).joinOrCreate("combat", joinOptions()).then((r) => {
  attach(r);
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
    // Keyboard sticks ramp up (about 0.3 s to full, back to centre in 0.15 s) and have expo, so a tap is a small input, not a snap roll.
    kbStick.elevator = ramp(kbStick.elevator, (k("KeyS") || k("ArrowDown")) - (k("KeyW") || k("ArrowUp")), frame);     // W/up = stick forward = nose down
    kbStick.aileron = ramp(kbStick.aileron, (k("KeyD") || k("ArrowRight")) - (k("KeyA") || k("ArrowLeft")), frame);
    kbStick.rudder = ramp(kbStick.rudder, k("KeyE") - k("KeyQ"), frame);
    sim.input.elevator = expo(kbStick.elevator); sim.input.aileron = expo(kbStick.aileron); sim.input.rudder = expo(kbStick.rudder);
  }
  sim.wind.set(...windAt(t / 1000 + windOffset, sim.pos.x, sim.pos.z));
  while (acc >= STEP) { sim.step(STEP); acc -= STEP; }
  const airborne = !sim.held && !sim.onGround && sim.pos.y > 0.2;
  if (!sim.held && !airborne && landedAt < 0) landedAt = t;                          // touchdown: fetch the model after a moment
  if (landedAt >= 0 && t - landedAt > 4000) home();
  myMesh.position.copy(sim.pos); myMesh.quaternion.copy(sim.quat);
  spinProp(myMesh, sim.held ? 0 : 60 + sim.input.throttle * 500, frame);
  sound.motor(sim.input.throttle, !sim.held && airborne && sim.energyWh > 0);
  if (!replay && online) { const pl = interpolated(performance.now()); if (pl) applyPlanes(pl); }
  for (const o of others.values()) {
    if (replay) { o.mesh.position.lerp(o.pos, 1 - Math.exp(-14 * frame)); o.mesh.quaternion.slerp(o.quat, 1 - Math.exp(-14 * frame)); }   // replay snapshots are sparse: smooth them
    else { o.mesh.position.copy(o.pos); o.mesh.quaternion.copy(o.quat); }
    spinProp(o.mesh, o.air ? 420 : 0, frame);
  }
  if (!replay) {                                                                     // my own streamer is always drawn locally
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(sim.quat);
    localStreamer.push([sim.pos.x + f.x * simParams.tailZ, sim.pos.y + f.y * simParams.tailZ, sim.pos.z + f.z * simParams.tailZ]);
    let v = views.get("local"); if (!v) { v = new StreamerView(scene, COLORS[me.pit]); views.set("local", v); }
    v.update(localStreamer.points(t / 1000).flat());
  } else if (views.get("local")) views.get("local").mesh.visible = false;
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
