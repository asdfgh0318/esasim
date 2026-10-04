import * as THREE from "three";
import { Client } from "@colyseus/sdk";
import { buildField } from "./field.js";
import { Plane } from "../shared/flight.js";
import { Streamer } from "../shared/streamer.js";
import { planeParams } from "../shared/planes/index.js";
import { FIELD, pitX } from "../shared/rules.js";
import { RadioInput } from "./input/radio.js";
import { mountRadioUI } from "./input/radioUI.js";
import { StreamerView } from "./streamerView.js";
import { CameraRig } from "./camera.js";
import { mountHud } from "./hud.js";
import { createPlane, setTint, spinProp, PLANE_TYPES, PLANE_NAMES } from "./planeModel.js";

const params = new URLSearchParams(location.search);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc9ee);
scene.fog = new THREE.Fog(0x9cc9ee, 150, 600);
scene.add(new THREE.HemisphereLight(0xffffff, 0x446644, 1.2), buildField());
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.append(renderer.domElement);
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const COLORS = [0xd23b3b, 0x3b6bd2, 0x2aa84a, 0xe0b000, 0x9b4bd0, 0x22b8c4, 0xe07a30];   // pilot colours by start box (tail and spinner)
const planeType = PLANE_TYPES.includes(params.get("plane")) ? params.get("plane") : "spitfire";
const simParams = planeParams(planeType);

// ---- state ----
const sim = new Plane(simParams);
let me = { id: null, pit: 3 };
let phase = "lobby", snapNames = new Map(), online = false;
const myMesh = createPlane(planeType, COLORS[me.pit]); scene.add(myMesh);
const others = new Map(), views = new Map();   // id -> { mesh, pos, quat } / StreamerView
const localStreamer = new Streamer({ seed: 9 }); // offline only
const rig = new CameraRig(camera);
const radio = new RadioInput(), updateRadioUI = mountRadioUI(radio);
const keys = new Set();
let room = null, landedAt = -1, kbThrottle = 0;

const hud = mountHud({
  ready: (v) => room?.send("ready", v), addBot: () => room?.send("addBot"), removeBots: () => room?.send("removeBots"), start: () => room?.send("start"),
  plane: (t) => { const u = new URLSearchParams(location.search); u.set("plane", t); location.search = u.toString(); },
}, { types: PLANE_TYPES, names: PLANE_NAMES, current: planeType });

function home() {                                  // plane back in the pilot's hand at the start box (ESA §4.4, §4.6)
  sim.pos.set(pitX(me.pit), 1.4, FIELD.pilotLineZ); sim.vel.set(0, 0, 0); sim.quat.identity(); sim.omega.set(0, 0, 0);
  sim.held = true; sim.onGround = false; sim.input.throttle = 0; kbThrottle = 0; landedAt = -1;
  localStreamer.reset([sim.pos.x, sim.pos.y, sim.pos.z + simParams.tailZ]);
}
home();
const canLaunch = () => sim.held && (!online || phase === "lobby" || phase === "prep" || phase === "flight");   // §4.2: no launches in readiness
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Space") { if (canLaunch()) { sim.launch(); } else if (sim.held) hud.toast("Not now: launch is allowed in the flight part (§4.2.3)"); }
});
addEventListener("keyup", (e) => keys.delete(e.code));

// ---- network ----
const nm = (id) => snapNames.get(id) || "?";
function onEvent(e) {
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
function onSnap(snap) {
  phase = snap.fight.phase;
  snapNames = new Map(snap.fight.pilots.map((p) => [p.id, p.name]));
  hud.update(snap, me.id);
  const seen = new Set();
  for (const p of snap.planes) {
    seen.add(p.id);
    let v = views.get(p.id);
    if (!v) { v = new StreamerView(scene, COLORS[p.pit % 7]); views.set(p.id, v); }
    v.update(p.streamer);
    if (p.id === me.id) continue;
    let o = others.get(p.id);
    if (!o) { o = { mesh: createPlane(p.plane, COLORS[p.pit % 7]), pos: new THREE.Vector3(...p.pos), quat: new THREE.Quaternion(), air: false }; o.mesh.position.copy(o.pos); scene.add(o.mesh); others.set(p.id, o); }
    o.pos.set(...p.pos); o.air = p.airborne;
    const z = new THREE.Vector3(...p.fwd), x = new THREE.Vector3(...p.right), y = new THREE.Vector3().crossVectors(z, x);
    o.quat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }
  for (const [id, o] of others) if (!seen.has(id)) { scene.remove(o.mesh); others.delete(id); }
  for (const [id, v] of views) if (!seen.has(id)) { v.dispose(); views.delete(id); }
}
new Client(`ws://${params.get("server") || location.hostname}:2567`).joinOrCreate("combat", { name: params.get("name") || "Pilot", plane: planeType }).then((r) => {
  room = r; online = true;
  r.onMessage("you", (y) => { me = y; rig.setPit(y.pit); setTint(myMesh, COLORS[y.pit % 7]); if (sim.held) home(); });
  r.onMessage("snap", onSnap); r.onMessage("events", (ev) => ev.forEach(onEvent));
  r.onMessage("restart", () => { home(); hud.toast("New fight"); });
  if (params.get("bots")) for (let i = 0; i < Number(params.get("bots")); i++) r.send("addBot");   // debug helpers for screenshots/tests
  if (params.has("autostart")) setTimeout(() => { r.send("ready", true); r.send("start"); }, 500);
}).catch(() => { console.warn("no server: offline practice"); hud.offline(); });

// ---- loop ----
const STEP = 1 / 240;
let last = performance.now(), acc = 0, sent = 0;
renderer.setAnimationLoop((t) => {
  const frame = Math.min((t - last) / 1000, 0.1); last = t; acc += frame;
  const k = (c) => (keys.has(c) ? 1 : 0);
  if (radio.poll()) Object.assign(sim.input, radio.channels);
  else {
    kbThrottle = THREE.MathUtils.clamp(kbThrottle + (k("KeyW") - k("KeyS")) * 0.4 * frame, 0, 1);
    sim.input.throttle = kbThrottle; sim.input.elevator = k("ArrowDown") - k("ArrowUp");
    sim.input.aileron = k("ArrowRight") - k("ArrowLeft"); sim.input.rudder = k("KeyD") - k("KeyA");
  }
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
    if (sim.held && others.size) {                                           // own model still in the hand: watch the airborne plane nearest to the middle of the action
      const air = [...others.values()].filter((o) => o.pos.y > 1);
      if (air.length) { const c = new THREE.Vector3(); air.forEach((o) => c.add(o.pos)); c.divideScalar(air.length); focus = air.reduce((best, o) => (o.pos.distanceTo(c) < best.pos.distanceTo(c) ? o : best)).mesh.position; }
    }
    rig.update(sim, frame, focus);
  }
  if (room && t - sent > 50) {
    sent = t;
    room.send("pose", { pos: sim.pos.toArray(), quat: sim.quat.toArray(), airborne, held: sim.held });
  }
  updateRadioUI();
  renderer.render(scene, camera);
});
