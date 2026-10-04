import * as THREE from "three";
import { Client } from "@colyseus/sdk";
import { buildField } from "./field.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc9ee);
scene.fog = new THREE.Fog(0x9cc9ee, 150, 600);
scene.add(new THREE.HemisphereLight(0xffffff, 0x446644, 1.2), buildField());

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.append(renderer.domElement);
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// Placeholder plane (1:12 warbird is ~0.8 m long). Flight model is a stub: kinematic, no aerodynamics yet.
function makePlane(color) {
  const p = new THREE.Group();
  p.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.8), new THREE.MeshLambertMaterial({ color })));
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.2), new THREE.MeshLambertMaterial({ color }));
  p.add(wing);
  return p;
}
const me = makePlane(0xd23b3b);
me.position.set(0, 1.5, -3);
scene.add(me);
camera.position.set(0, 2.7, -7);
const TOP = new URLSearchParams(location.search).has("top"); // debug: plan view of the site
if (TOP) { camera.position.set(0, 110, -20); camera.lookAt(0, 0, -20); camera.far = 2000; camera.updateProjectionMatrix(); me.position.set(0, 1.5, -1.5); }
const others = new Map();
let throttle = 0.5;

const keys = new Set();
addEventListener("keydown", (e) => keys.add(e.code));
addEventListener("keyup", (e) => keys.delete(e.code));

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

let last = performance.now(), sent = 0;
renderer.setAnimationLoop((t) => {
  const dt = Math.min((t - last) / 1000, 0.05); last = t;
  const k = (c) => keys.has(c) ? 1 : 0;
  throttle = THREE.MathUtils.clamp(throttle + (k("KeyW") - k("KeyS")) * dt * 0.5, 0, 1);
  me.rotateX((k("ArrowDown") - k("ArrowUp")) * dt * 1.5);
  me.rotateZ((k("ArrowLeft") - k("ArrowRight")) * dt * 2.5);
  me.rotateY((k("KeyA") - k("KeyD")) * dt * 0.8);
  me.translateZ(throttle * 15 * dt);
  if (me.position.y < 0.3) me.position.y = 0.3;
  const back = new THREE.Vector3(0, 1.2, -4).applyQuaternion(me.quaternion).add(me.position);
  if (!TOP) { camera.position.lerp(back, 0.1); camera.lookAt(me.position); }
  if (room && t - sent > 50) { sent = t; room.send("pose", { pos: me.position.toArray(), quat: me.quaternion.toArray() }); }
  renderer.render(scene, camera);
});
