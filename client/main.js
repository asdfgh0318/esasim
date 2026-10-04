import * as THREE from "three";
import { Client } from "@colyseus/sdk";
import { buildField } from "./field.js";
import { Plane } from "../shared/flight.js";
import { FW190D } from "../shared/planes/fw190d.js";
import { RadioInput } from "./input/radio.js";
import { mountRadioUI } from "./input/radioUI.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc9ee);
scene.fog = new THREE.Fog(0x9cc9ee, 150, 600);
scene.add(new THREE.HemisphereLight(0xffffff, 0x446644, 1.2), buildField());

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.append(renderer.domElement);
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function makePlane(color) {   // placeholder mesh until Adam's models arrive (1:12 warbird is ~0.85 m long)
  const p = new THREE.Group();
  p.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.85), new THREE.MeshLambertMaterial({ color })));
  p.add(new THREE.Mesh(new THREE.BoxGeometry(0.875, 0.02, 0.16), new THREE.MeshLambertMaterial({ color })));
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.1), new THREE.MeshLambertMaterial({ color }));
  tail.position.set(0, 0, -0.38);
  p.add(tail);
  return p;
}
const sim = new Plane(FW190D);
sim.pos.set(0, 0.08, -1.5);                    // on start pit 4, facing the field (§Fig 1)
const me = makePlane(0xd23b3b);
scene.add(me);
camera.position.set(0, 2.7, -7);
const TOP = new URLSearchParams(location.search).has("top"); // debug: plan view of the site
if (TOP) { camera.position.set(0, 110, -20); camera.lookAt(0, 0, -20); camera.far = 2000; camera.updateProjectionMatrix(); }
const others = new Map();

const radio = new RadioInput();
const updateRadioUI = mountRadioUI(radio);
const keys = new Set();
addEventListener("keydown", (e) => keys.add(e.code));
addEventListener("keyup", (e) => keys.delete(e.code));
const hud = document.getElementById("hud");
let kbThrottle = 0;

let room = null;
new Client(`ws://${location.hostname}:2567`).joinOrCreate("combat").then((r) => {
  room = r;
  r.onMessage("poses", (poses) => {
    for (const [id, p] of Object.entries(poses)) {
      if (id === r.sessionId) continue;
      let o = others.get(id);
      if (!o) { o = makePlane(0x3b6bd2); others.set(id, o); scene.add(o); }
      o.position.fromArray(p.pos); o.quaternion.fromArray(p.quat);
    }
    for (const [id, o] of others) if (!(id in poses)) { scene.remove(o); others.delete(id); }
  });
}).catch(() => console.warn("no server: offline mode"));

const STEP = 1 / 240;
let last = performance.now(), acc = 0, sent = 0;
renderer.setAnimationLoop((t) => {
  acc += Math.min((t - last) / 1000, 0.1); last = t;
  const k = (c) => (keys.has(c) ? 1 : 0);
  if (radio.poll()) {                                   // radio wins when connected
    Object.assign(sim.input, radio.channels);
  } else {                                              // keyboard fallback
    kbThrottle = THREE.MathUtils.clamp(kbThrottle + (k("KeyW") - k("KeyS")) * 0.4 * (1 / 60), 0, 1);
    sim.input.throttle = kbThrottle;
    sim.input.elevator = k("ArrowDown") - k("ArrowUp");  // stick back = nose up
    sim.input.aileron = k("ArrowRight") - k("ArrowLeft");
    sim.input.rudder = k("KeyD") - k("KeyA");
  }
  while (acc >= STEP) { sim.step(STEP); acc -= STEP; }
  me.position.copy(sim.pos); me.quaternion.copy(sim.quat);
  if (!TOP) {
    const back = new THREE.Vector3(0, 1.0, -3.5).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), new THREE.Euler().setFromQuaternion(sim.quat, "YXZ").y)).add(sim.pos);
    camera.position.lerp(back, 0.08); camera.lookAt(sim.pos);
  }
  hud.textContent = `ESASIM · ${radio.connected ? "radio" : "keyboard: arrows pitch/roll, A/D yaw, W/S throttle"} · R: radio setup · ${sim.airspeed.toFixed(0)} m/s · ${sim.pos.y.toFixed(0)} m · thr ${(sim.input.throttle * 100).toFixed(0)}%`;
  updateRadioUI();
  if (room && t - sent > 50) { sent = t; room.send("pose", { pos: sim.pos.toArray(), quat: sim.quat.toArray() }); }
  renderer.render(scene, camera);
});
