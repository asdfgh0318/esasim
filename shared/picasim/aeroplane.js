// Derived from PicaSim by Danny Chapman (https://github.com/Rowlhouse/PicaSim), PolyForm Noncommercial License 1.0.0.
// Required Notice: Copyright (c) 2026 Danny Chapman (https://www.rowlhouse.co.uk/PicaSim). See NOTICE.
// An aeroplane as in PicaSim's AeroplanePhysics: a rigid body whose mass comes from the wing/fuselage/shape boxes, driven by
// aerofoil elements, box-drag fuselages and propeller engines. PicaSim uses Bullet; here a small 6-DOF integrator replaces it,
// and wheels are replaced by penalty ground contacts (the ESA planes are belly-landers).
import * as THREE from "three";
import { Tm, DimensionalScaling, rotationQuat } from "./math.js";
import { AerofoilDefinition } from "./aerofoil.js";
import { Wing, Fuselage, PropellerEngine } from "./components.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const G = 9.81;

// Resolve a definition: expand copy/mirror, apply the aeroplane settings (size/mass/engine/drag scale), PicaSim style.
export function resolveDef(def) {
  const s = { sizeScale: 1, massScale: 1, dragScale: 1, engineScale: 1, extraMassPercent: 0, ...(def.settings || {}) };
  const ds = new DimensionalScaling(s.sizeScale, s.massScale, true), dsE = new DimensionalScaling(s.sizeScale, s.massScale, false);
  const L = (a) => a.map((v) => v * s.sizeScale);
  const wings = [];
  for (const w0 of def.wings) {
    let w = { ...w0 };
    if (w0.copy) w = { ...structuredClone(wings.find((x) => x.name === w0.copy)?.src || def.wings.find((x) => x.name === w0.copy)), ...structuredClone(w0) };
    const src = structuredClone(w);
    if (w.mirror) {
      w.position = [w.position[0], -w.position[1], w.position[2]]; w.extents = [w.extents[0], -w.extents[1], w.extents[2]];
      const r = w.rotation || [0, 0, 0]; w.rotation = [-r[0], r[1], -r[2]];
      if (w.shadow) w.shadow = [w.shadow[0], -w.shadow[1], w.shadow[2]];
      w.roll = -(w.roll || 0); w.yaw = -(w.yaw || 0);
      const c = { ...(w.controlPerChannel || {}) }; if (c[0] !== undefined) c[0] *= -1; if (c[2] !== undefined) c[2] *= -1; w.controlPerChannel = c;
    }
    w.mass = ds.mass(w.mass ?? 1); w.position = L(w.position); w.extents = L(w.extents);
    wings.push({ ...w, src });
  }
  const fuselages = (def.fuselages || []).map((f) => ({ ...f, mass: ds.mass(f.mass ?? 0), position: L(f.position), extents: L(f.extents) }));
  const shapes = (def.shapes || []).map((f) => ({ ...f, mass: ds.mass(f.mass ?? 0), position: L(f.position), extents: L(f.extents) }));
  const engines = (def.engines || []).map((e) => ({
    ...e, radius: dsE.length(e.radius), pitch: dsE.length(e.pitch), bladeChord: dsE.length(e.bladeChord), inertia: dsE.inertia(e.inertia),
    maxTorque: dsE.torque(e.maxTorque), maxRPM: (e.maxRPM * dsE.angVel(1) * s.engineScale * Math.sqrt(s.massScale)), minRPM: (e.minRPM || 0) * dsE.angVel(1) * s.engineScale * Math.sqrt(s.massScale),
    frictionTorque: dsE.torque(e.frictionTorque || 0), transitionalLiftSpeed: dsE.vel(e.transitionalLiftSpeed ?? 5), position: L(e.position || [0, 0, 0]),
  }));
  const dyn = def.dynamics || {};
  return {
    name: def.name, settings: s, wings, fuselages, shapes, engines, aerofoils: def.aerofoils,
    groundPoints: (def.groundPoints || []).map((g) => ({ ...g, position: L(g.position) })),
    dynamics: { wingSpan: ds.length(dyn.wingSpan || 1), wingChord: ds.length(dyn.wingChord || 0.1), CMRollFromY: ds.length(dyn.CMRollFromY || 0) },
    battery: def.battery || null,
  };
}

export class PicaAeroplane {
  constructor(resolved) {
    this.def = resolved; this.dragScale = resolved.settings.dragScale; this.airDensity = 1.225;
    const aero = {}; for (const [k, v] of Object.entries(resolved.aerofoils)) aero[k] = new AerofoilDefinition(v);
    this.wings = resolved.wings.map((w) => new Wing(w, aero, this));
    this.fuselages = resolved.fuselages.map((f) => new Fuselage(f, this));
    this.engines = resolved.engines.map((e) => new PropellerEngine(e, this));
    this.groundPoints = resolved.groundPoints;
    this.controls = { 0: 0, 1: 0, 2: 0, 3: 0 };
    this.batteryEmpty = false;
    this.windVec = V();
    // --- mass and inertia from boxes
    const boxes = [];
    for (const w of this.wings) boxes.push({ m: w.mass, tm: w.tmLocal, ext: w.extents });
    for (const f of this.fuselages) boxes.push({ m: f.mass, tm: f.tmLocal, ext: f.extents });
    for (const s of resolved.shapes) boxes.push({ m: s.mass, tm: new Tm(new THREE.Vector3(...s.position), rotationQuat(s.rotation, s.roll, s.pitch, s.yaw)), ext: new THREE.Vector3(...s.extents) });
    this.mass = boxes.reduce((a, b) => a + b.m, 0);
    const extra = 0.01 * resolved.settings.extraMassPercent * this.mass;
    this.comOffset = V();
    for (const b of boxes) this.comOffset.add(b.tm.p.clone().multiplyScalar(b.m));
    this.comOffset.divideScalar(this.mass);
    this.mass += extra;
    const I = new THREE.Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0);
    for (const b of boxes) {
      const R = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(b.tm.q));
      const e = b.ext, Ib = new THREE.Matrix3().set(b.m / 12 * (e.y * e.y + e.z * e.z), 0, 0, 0, b.m / 12 * (e.x * e.x + e.z * e.z), 0, 0, 0, b.m / 12 * (e.x * e.x + e.y * e.y));
      const Rt = R.clone().transpose(), Iw = R.clone().multiply(Ib).multiply(Rt);
      const d = b.tm.p.clone().sub(this.comOffset), dd = d.lengthSq();
      const par = new THREE.Matrix3().set(dd - d.x * d.x, -d.x * d.y, -d.x * d.z, -d.y * d.x, dd - d.y * d.y, -d.y * d.z, -d.z * d.x, -d.z * d.y, dd - d.z * d.z).multiplyScalar(b.m);
      for (let i = 0; i !== 9; i++) I.elements[i] += Iw.elements[i] + par.elements[i];
    }
    this.I = I; this.Iinv = I.clone().invert();
    // --- state: body frame = model frame; com in world; omega in the body frame
    this.q = new THREE.Quaternion(); this.com = V(); this.comVel = V(); this.omegaB = V();
    this.F = V(); this.T = V(); this.extraL = V();
    this.tm = new Tm(); this.onGround = false; this.contactForce = 0;
    this.setPose(V(0, 0, 1), new THREE.Quaternion());
  }

  // ---- state access
  setPose(modelPos, q) { this.q.copy(q); this.com.copy(modelPos).add(this.comOffset.clone().applyQuaternion(q)); this._updateTm(); }
  modelPos() { return this.com.clone().sub(this.comOffset.clone().applyQuaternion(this.q)); }
  _updateTm() { this.tm = new Tm(this.modelPos(), this.q.clone()); }
  angularVelocityWorld() { return this.omegaB.clone().applyQuaternion(this.q); }
  velAtPoint(p) { return this.comVel.clone().add(this.angularVelocityWorld().cross(p.clone().sub(this.com))); }
  windAt() { return this.windVec; }
  getEngine(name) { return this.engines.find((e) => e.name === name); }
  getWing(name) { return this.wings.find((w) => w.name === name); }
  applyForceAtPoint(f, p) { this.F.add(f); this.T.add(p.clone().sub(this.com).cross(f)); }
  applyForceAtCoM(f) { this.F.add(f); }
  applyTorque(t) { this.T.add(t); }
  addExtraAngularMomentum(Lw) { this.extraL.add(Lw); }
  get electricPower() { return this.engines.reduce((a, e) => a + e.electricPower, 0); }

  step(dt) {
    this.F.set(0, 0, 0); this.T.set(0, 0, 0); this.extraL.set(0, 0, 0);
    this._updateTm();
    for (const w of this.wings) w.updatePostPhysics();
    for (const e of this.engines) e.updatePostPhysics();
    for (const e of this.engines) e.updatePrePhysics(dt);
    for (const w of this.wings) w.updatePrePhysics(dt);
    for (const f of this.fuselages) f.updatePrePhysics(dt);
    // rolling moment from sideslip (the dihedral effect of the whole airframe, not covered by the aerofoils)
    const dyn = this.def.dynamics;
    if (dyn.CMRollFromY) {
      const air = this.tm.rotateInv(this.windVec.clone().sub(this.comVel)), qy = 0.5 * this.airDensity * air.y * Math.abs(air.y);
      this.applyTorque(this.tm.rowX().multiplyScalar(-dyn.CMRollFromY * qy * dyn.wingSpan * dyn.wingChord * dyn.wingSpan));
    }
    this.F.add(V(0, 0, -G * this.mass));
    this._ground();
    // integrate
    this.comVel.add(this.F.clone().multiplyScalar(dt / this.mass));
    this.com.add(this.comVel.clone().multiplyScalar(dt));
    const Rt = this.q.clone().invert(), tauB = this.T.clone().applyQuaternion(Rt), exB = this.extraL.clone().applyQuaternion(Rt);
    const Lb = this.omegaB.clone().applyMatrix3(this.I).add(exB);
    const rhs = tauB.sub(this.omegaB.clone().cross(Lb));
    this.omegaB.add(rhs.applyMatrix3(this.Iinv).multiplyScalar(dt));
    const w = this.omegaB, mag = w.length();
    if (mag > 1e-9) this.q.multiply(new THREE.Quaternion().setFromAxisAngle(w.clone().divideScalar(mag), mag * dt)).normalize();
  }

  // Penalty ground contacts (flat ground z = 0), spring-damper with Coulomb-limited friction.
  _ground() {
    const K = 3000, C = 25, MU = 0.6, KF = 40;
    this.onGround = false; this.contactForce = 0;
    const pts = [...this.groundPoints];
    for (const g of pts) {
      const p = this.tm.transform(new THREE.Vector3(...g.position));
      if (p.z >= 0) continue;
      this.onGround = true;
      const v = this.velAtPoint(p), d = -p.z;
      const N = Math.max(0, K * d - C * v.z);
      this.contactForce += N;
      const ft = V(-v.x * KF, -v.y * KF, 0), lim = MU * N, len = ft.length();
      if (len > lim) ft.multiplyScalar(lim / len);
      this.applyForceAtPoint(V(ft.x, ft.y, N), p);
    }
  }
}
