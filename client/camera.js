import * as THREE from "three";
import { FIELD, pitX } from "../shared/rules.js";

// Camera modes: "pilot" (default: standing at the start box behind the pilot line, like a real pilot: P) and
// "fpv" (analog-style video from the nose: V). No chase camera on purpose.
const PLAN = new URLSearchParams(location.search).has("plan");
const HERO = new URLSearchParams(location.search).has("hero");
const clampFov = (v) => Math.min(100, Math.max(35, Math.round(Number(v)) || 60));
const loadFov = () => { try { return clampFov(localStorage.getItem("esasim-fov") ?? 60); } catch { return 60; } };
export class CameraRig {
  constructor(camera) { this.camera = camera; this.fov = loadFov(); this.mode = "pilot"; this.pit = 3; this.p = new THREE.Vector3(); addEventListener("keydown", (e) => {
    if (e.code === "KeyP") this.mode = "pilot"; else if (e.code === "KeyV") this.mode = "fpv";
  }); }
  setPit(i) { this.pit = i; }
  setFov(v) { this.fov = clampFov(v); try { localStorage.setItem("esasim-fov", String(this.fov)); } catch { /* no storage */ } }
  // focus: what the pilot looks at (own plane, or the other planes while own model is still in the hand).
  update(sim, dt, focus = sim.pos) {
    const cam = this.camera, k = 1 - Math.exp(-6 * dt);
    if (PLAN) { cam.position.set(0, 140, 30); cam.up.set(0, 0, 1); cam.lookAt(0, 0, 30); if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); } return; }
    if (this.mode === "pilot" && HERO) {                                    // ?hero: fixed wide framing for screenshots, landing field below, the fight above
      cam.position.set(pitX(this.pit), 1.7, FIELD.pilotLineZ - 0.8); cam.lookAt(0, 10, 50);
      if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
    } else if (this.mode === "pilot") {
      this.p.set(pitX(this.pit), 1.7, FIELD.pilotLineZ - 0.8);
      cam.position.copy(this.p);
      cam.lookAt(focus.x, Math.max(focus.y, 0.5), focus.z);
      if (cam.fov !== this.fov) { cam.fov = this.fov; cam.updateProjectionMatrix(); }   // the pilot's chosen field of view (default 60): follow the plane, no zoom
    } else {
      cam.position.copy(sim.pos).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(sim.quat), 0.31).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(sim.quat), 0.03);   // just ahead of the spinner tip
      cam.quaternion.copy(sim.quat).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      if (cam.fov !== 70) { cam.fov = 70; cam.updateProjectionMatrix(); }   // FPV lens: 70 degrees, not fisheye
    }
  }
}
