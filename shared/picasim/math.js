// Derived from PicaSim by Danny Chapman (https://github.com/Rowlhouse/PicaSim), PolyForm Noncommercial License 1.0.0.
// Required Notice: Copyright (c) 2026 Danny Chapman (https://www.rowlhouse.co.uk/PicaSim). See NOTICE.
// Frame used inside shared/picasim/: X forward, Y left, Z up (PicaSim's convention). plane.js converts to ESASIM's world.
import * as THREE from "three";

export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smoothStep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);

// A rigid transform: local -> parent (p + q * v). PicaSim's "RowX/RowY/RowZ" are the local axes expressed in the parent frame.
export class Tm {
  constructor(p = new THREE.Vector3(), q = new THREE.Quaternion()) { this.p = p; this.q = q; }
  clone() { return new Tm(this.p.clone(), this.q.clone()); }
  rowX() { return AX.clone().applyQuaternion(this.q); }
  rowY() { return AY.clone().applyQuaternion(this.q); }
  rowZ() { return AZ.clone().applyQuaternion(this.q); }
  rotate(v) { return v.clone().applyQuaternion(this.q); }
  rotateInv(v) { return v.clone().applyQuaternion(this.q.clone().invert()); }
  transform(v) { return v.clone().applyQuaternion(this.q).add(this.p); }
  // local * parent: apply this (local) first, then parent
  static compose(local, parent) { return new Tm(local.transform0(parent), parent.q.clone().multiply(local.q)); }
  transform0(parent) { return this.p.clone().applyQuaternion(parent.q).add(parent.p); }
}

// Rotation given as an axis*angle vector in degrees, optionally combined with roll/pitch/yaw (PicaSim's ApplyRollPitchYawToRotationDegrees:
// R = R(rotation) * Rz(yaw) * Ry(pitch) * Rx(roll)).
export function rotationQuat(rot = [0, 0, 0], roll = 0, pitch = 0, yaw = 0) {
  const v = new THREE.Vector3(...rot), q = new THREE.Quaternion();
  const ang = v.length() * DEG;
  if (ang > 0) q.setFromAxisAngle(v.clone().normalize(), ang);
  if (roll || pitch || yaw) {
    const e = new THREE.Quaternion().setFromAxisAngle(AZ, yaw * DEG)
      .multiply(new THREE.Quaternion().setFromAxisAngle(AY, pitch * DEG))
      .multiply(new THREE.Quaternion().setFromAxisAngle(AX, roll * DEG));
    q.multiply(e);
  }
  return q;
}

// PicaSim's DimensionalScaling: scale an aeroplane by size and mass (aero scaling keeps the flying character).
export class DimensionalScaling {
  constructor(sizeScale, massScale, useAeroScaling) {
    this.L = sizeScale; this.M = massScale * sizeScale ** 3; this.T = Math.sqrt(sizeScale);
    if (useAeroScaling) this.T /= Math.sqrt(massScale);
  }
  length(v) { return v * this.L; } mass(v) { return v * this.M; } inertia(v) { return v * this.M * this.L ** 2; }
  time(v) { return v * this.T; } vel(v) { return v * this.L / this.T; } angVel(v) { return v / this.T; }
  torque(v) { return v * this.M * (this.L / this.T) ** 2; } force(v) { return v * this.M * this.L / (this.T ** 2); }
}
