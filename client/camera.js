import * as THREE from "three";
import { FIELD, pitX } from "../shared/rules.js";

// Camera modes: "pilot" (standing at the start box behind the pilot line, like a real pilot: P),
// "chase" (C), "fpv" (from the nose: V).
export class CameraRig {
  constructor(camera) { this.camera = camera; this.mode = "pilot"; this.pit = 3; this.p = new THREE.Vector3(); addEventListener("keydown", (e) => {
    if (e.code === "KeyP") this.mode = "pilot"; else if (e.code === "KeyC") this.mode = "chase"; else if (e.code === "KeyV") this.mode = "fpv";
  }); }
  setPit(i) { this.pit = i; }
  // focus: what the pilot looks at (own plane, or the other planes while own model is still in the hand).
  update(sim, dt, focus = sim.pos) {
    const cam = this.camera, k = 1 - Math.exp(-6 * dt);
    if (this.mode === "pilot") {
      this.p.set(pitX(this.pit), 1.7, FIELD.pilotLineZ - 0.8);
      cam.position.copy(this.p);
      cam.lookAt(focus.x, Math.max(focus.y, 0.5), focus.z);
      const dist = Math.max(cam.position.distanceTo(focus), 1);
      const fov = THREE.MathUtils.clamp((2 * Math.atan(3 / dist) * 180) / Math.PI, 12, 60);   // zoom like eyes on a distant model
      cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix();
    } else if (this.mode === "chase") {
      const yaw = new THREE.Euler().setFromQuaternion(sim.quat, "YXZ").y;
      const back = new THREE.Vector3(0, 0.9, -3).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)).add(sim.pos);
      cam.position.lerp(back, k); cam.lookAt(sim.pos);
      if (cam.fov !== 65) { cam.fov = 65; cam.updateProjectionMatrix(); }
    } else {
      cam.position.copy(sim.pos).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(sim.quat), 0.25).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(sim.quat), 0.04);
      cam.quaternion.copy(sim.quat).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      if (cam.fov !== 90) { cam.fov = 90; cam.updateProjectionMatrix(); }
    }
  }
}
