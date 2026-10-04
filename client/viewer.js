// Model viewer (dev tool): /viewer.html?plane=spitfire|hurricane|fw190|yak3|all&view=iso|side|top|front
import * as THREE from "three";
import { createPlane, PLANE_TYPES } from "./planeModel.js";

const q = new URLSearchParams(location.search);
const type = q.get("plane") || "all", view = q.get("view") || "iso";
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb9d6ee);
scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.4)); const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(2, 4, 1); scene.add(sun);
const list = type === "all" ? PLANE_TYPES : [type];
const cols = list.length > 1 ? 2 : 1;
list.forEach((t, i) => { const p = createPlane(t, [0xd23b3b, 0x3b6bd2, 0xe0b000, 0x2aa84a][i % 4]); p.position.set((i % cols - (cols - 1) / 2) * 1.0, 0, -Math.floor(i / cols) * 0.9 + (list.length > 2 ? 0.45 : 0)); scene.add(p); });
const cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 50);
const dist = list.length > 1 ? 3.4 : 1.6;
const dirs = { iso: [0.9, 0.7, -1.0], side: [1, 0.05, 0], top: [0, 1, 0.001], front: [0, 0.05, 1] };
const d = new THREE.Vector3(...dirs[view]).normalize().multiplyScalar(dist);
cam.position.copy(d).add(new THREE.Vector3(0, 0, list.length > 2 ? -0.45 : 0)); cam.lookAt(0, 0, list.length > 2 ? -0.45 : 0);
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(innerWidth, innerHeight); document.body.append(r.domElement);
r.setAnimationLoop(() => r.render(scene, cam));
