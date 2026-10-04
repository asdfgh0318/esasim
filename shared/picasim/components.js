// Derived from PicaSim by Danny Chapman (https://github.com/Rowlhouse/PicaSim), PolyForm Noncommercial License 1.0.0.
// Required Notice: Copyright (c) 2026 Danny Chapman (https://www.rowlhouse.co.uk/PicaSim). See NOTICE.
// Ports of Wing.cpp (control surfaces made of aerofoil elements), Fuselage.cpp (box drag) and PropellerEngine.cpp
// (blade-element propeller with RPM dynamics, wash, gyroscopic momentum and damping).
import * as THREE from "three";
import { DEG, clamp, Tm, rotationQuat } from "./math.js";
import { applyAerofoilForces } from "./aerofoil.js";

const PI = Math.PI;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const CH = { AILERON: 0, ELEVATOR: 1, RUDDER: 2, THROTTLE: 3 };     // PicaSim's Controller channels

// ---------------------------------------------------------------------------------------------------------------- Wing
export class Wing {
  // w: resolved wing definition (already scaled); aerofoilDefs: { name: AerofoilDefinition }
  constructor(w, aerofoilDefs, plane) {
    this.plane = plane; this.name = w.name; this.mass = Math.max(w.mass, 1e-8); this.def = aerofoilDefs[w.aerofoil];
    this.cpc = w.controlPerChannel || {}; this.cpac = w.controlPerAbsChannel || {}; this.cdc = w.controlDifferentialPerChannel || {}; this.cec = w.controlExpPerChannel || {};
    this.CLPerDegree = w.CLPerDegree || 0; this.CDPerDegree = w.CDPerDegree || 0; this.CMPerDegree = w.CMPerDegree || 0;
    this.degreesPerControl = w.degreesPerControl || 0; this.flapFraction = w.flapFraction || 0; this.trimControl = w.trimControl || 0;
    this.controlRate = w.controlRate ?? 10; this.controlClamp = w.controlClamp ?? Infinity;
    const ext = new THREE.Vector3(...w.extents), pos = new THREE.Vector3(...w.position);
    const q = rotationQuat(w.rotation, w.roll, w.pitch, w.yaw);
    const nSec = w.numSections || 1, nPieces = w.numPieces || 1;
    this.extents = new THREE.Vector3(ext.x, Math.abs(ext.y), ext.z);
    const offsetRowX = new Tm(V(), q).rowX(), offsetRowY = new Tm(V(), q).rowY();
    this.tmLocal = new Tm(pos.clone().add(offsetRowY.clone().multiplyScalar(ext.y * 0.5)), q.clone());
    const pieceExt = V(Math.abs(ext.x / nPieces), Math.abs(ext.y / nSec), ext.z);
    this.aerofoils = [];
    for (let ip = 0; ip !== nPieces; ip++) for (let is = 0; is !== nSec; is++) {
      const f = (is + 0.5) / nSec, g = ip + 0.5;
      const p = pos.clone().sub(offsetRowX.clone().multiplyScalar(nPieces * pieceExt.x * 0.5))
        .add(offsetRowX.clone().multiplyScalar(pieceExt.x * g)).add(offsetRowY.clone().multiplyScalar(ext.y * f));
      this.aerofoils.push({
        cfg: {
          offset: new Tm(p, q.clone()), ext: pieceExt.clone(), shadow: new THREE.Vector3(...(w.shadow || [0, 0, 0])), area: pieceExt.x * pieceExt.y,
          AR: w.wingAspectRatio ?? 1, spanEff: w.wingSpanEfficiency ?? 0.9, controlHalfSpeed: w.controlHalfSpeed ?? 100, groundEffect: !!w.groundEffect,
          washEngine: w.washFromEngine || null, washWings: w.washFromWing || [],
        },
        par: { tm: new Tm(), vel: V() }, st: { lastAoA: 0 }, prevFlying: 1,
      });
    }
    this.control = 0; this.flapAngle = 0; this.lastWash = V(); this.lastForce = V();
  }
  worldPos() { return Tm.compose(this.tmLocal, this.plane.tm).p; }
  updatePostPhysics() {
    for (const a of this.aerofoils) {
      a.par.tm = Tm.compose(a.cfg.offset, this.plane.tm);
      a.par.vel = this.plane.velAtPoint(a.par.tm.p.clone().add(a.par.tm.rowX().multiplyScalar(a.cfg.ext.x * 0.5 * a.prevFlying)));
    }
  }
  updatePrePhysics(dt) {
    let control = this.trimControl;
    const ctl = this.plane.controls;
    for (const k of Object.keys({ ...this.cpc, ...this.cpac })) {
      const ch = Number(k), v = ctl[ch] || 0;
      let c = (this.cpc[k] || 0) * v + (this.cpac[k] || 0) * Math.abs(v);
      const exp = this.cec[k] ?? 1, diff = this.cdc[k] || 0;
      if (c > 0) { c = Math.pow(c, exp) * (1 + diff); } else { c = -Math.pow(-c, exp) * (1 - diff); }
      control += c;
    }
    const maxD = this.controlRate * dt;                                  // finite servo speed
    this.control += clamp(control - this.control, -maxD, maxD);
    this.control = clamp(this.control, -this.controlClamp, this.controlClamp);
    this.flapAngle = this.control * this.degreesPerControl;
    const fa = this.flapAngle;
    const ctrl = {
      extraCL: this.CLPerDegree * clamp(fa, -60, 60), extraCM: this.CMPerDegree * clamp(fa, -60, 60),
      extraCamber: fa * DEG * (1 - (2 * this.flapFraction - 1) ** 2), extraCD: this.CDPerDegree * 45 * (1 - Math.cos(fa * DEG)),
      extraAngle: Math.asin(this.flapFraction * Math.sin(fa * DEG)), CDScale: this.plane.dragScale,
    };
    this.lastWash.set(0, 0, 0); this.lastForce.set(0, 0, 0);
    for (const a of this.aerofoils) {
      const r = applyAerofoilForces(this.def, a.cfg, a.par, ctrl, this.plane, a.st);
      a.prevFlying = r.flying;
      this.lastWash.add(r.wash.multiplyScalar(1 / this.aerofoils.length)); this.lastForce.add(r.force);
    }
  }
}

// ----------------------------------------------------------------------------------------------------------- Fuselage
export class Fuselage {
  constructor(f, plane) {
    this.plane = plane; this.name = f.name; this.mass = Math.max(f.mass, 1e-8);
    this.extents = new THREE.Vector3(...f.extents); this.CD = new THREE.Vector3(...f.CD);
    this.tmLocal = new Tm(new THREE.Vector3(...f.position), rotationQuat(f.rotation, f.roll, f.pitch, f.yaw));
  }
  updatePrePhysics() {
    const tm = Tm.compose(this.tmLocal, this.plane.tm);
    const wind = this.plane.windAt(tm.p);
    const air = tm.rotateInv(wind.clone().sub(this.plane.comVel));
    const dp = V(0.5 * this.plane.airDensity * air.x * Math.abs(air.x), 0.5 * this.plane.airDensity * air.y * Math.abs(air.y), 0.5 * this.plane.airDensity * air.z * Math.abs(air.z));
    const e = this.extents, s = this.plane.dragScale;
    const drag = V(e.y * e.z * dp.x * this.CD.x * s, e.z * e.x * dp.y * this.CD.y * s, e.x * e.y * dp.z * this.CD.z * s);
    this.lastForce = tm.rotate(drag);
    this.plane.applyForceAtCoM(this.lastForce);
  }
}

// ------------------------------------------------------------------------------------------------------------- Engine
const ENGINE_DEFAULTS = {
  numBlades: 2, numRings: 4, radius: 0.1905, pitch: 0.18, bladeChord: 0.015, CL0: 0.5, CLPerDegree: 0.1, CD0: 0.05, CDInducedMultiplier: 2,
  stallAngle: 10, inertia: 0.001, maxTorque: 10, maxRPM: 0, minRPM: 0, frictionTorque: 0, aeroTorqueScale: 1, washRotationFraction: 0,
  propDiskAreaScale: 0.4, transitionalLiftSpeed: 5, transitionalLiftAmount: 0.15, controlExp: 1, controlRate: 20, electricEfficiency: 0.75,
};
export class PropellerEngine {
  constructor(e, plane) {
    this.plane = plane; this.name = e.name;
    Object.assign(this, { ...ENGINE_DEFAULTS, ...e });
    this.CLPerRadian = this.CLPerDegree * 180 / PI;
    this.maxW = this.maxRPM * 2 * PI / 60; this.minW = this.minRPM * 2 * PI / 60;
    this.tmLocal = new Tm(new THREE.Vector3(...(e.position || [0, 0, 0])), rotationQuat(e.rotation, e.roll, e.pitch, e.yaw));
    this.cpc = e.controlPerChannel || { 3: 1 };
    this.solidity = 2 * this.bladeChord * this.radius / (PI * this.radius * this.radius);
    this.tm = this.tmLocal.clone(); this.vel = V(); this.lastWash = V(); this.lastWashAngVel = V();
    this.control = 0; this.W = 0; this.angle = 0; this.electricPower = 0; this.thrust = 0;
  }
  getLastWash(angVelOut) { angVelOut.copy(this.lastWashAngVel); return this.lastWash.clone(); }
  updatePostPhysics() { this.tm = Tm.compose(this.tmLocal, this.plane.tm); this.vel = this.plane.velAtPoint(this.tm.p); }
  updatePrePhysics(dt) {
    const plane = this.plane;
    let control = 0;
    for (const k of Object.keys(this.cpc)) control += clamp(this.cpc[k] * (plane.controls[k] || 0), -1, 1);
    control = Math.pow(clamp(control, 0, 1), this.controlExp);
    const maxD = this.controlRate * dt;
    this.control += clamp(control - this.control, -maxD, maxD);
    const throttle = plane.batteryEmpty ? 0 : this.control;
    const thrustDir = this.tm.rowX();
    const propForwardSpeed = this.vel.dot(thrustDir);
    let wind = plane.windAt(this.tm.p);
    const velRelWind = this.vel.clone().sub(wind), speedRelWind = velRelWind.length();
    const washFrac = clamp(1 - speedRelWind / this.transitionalLiftSpeed, 0, 1);
    wind = wind.clone().add(this.lastWash.clone().multiplyScalar(this.transitionalLiftAmount * washFrac));
    let v0 = propForwardSpeed - wind.dot(thrustDir);
    const rho = plane.airDensity, aspect = this.radius / this.bladeChord, dR = this.radius / this.numRings;
    const stallHigh = this.stallAngle * DEG, stallLow = -this.stallAngle * DEG, stallRange = 5 * DEG;
    let propForce = 0, propTorque = 0;
    for (let i = 0; i !== this.numRings; i++) {
      const r = (0.5 + i) * this.radius / this.numRings;
      const bladeAngle = Math.atan2(this.pitch, 2 * PI * r);
      const bladeSpeed = this.W * r, airSpeedSq = bladeSpeed * bladeSpeed + v0 * v0;
      const airflowAngle = -Math.atan2(v0, bladeSpeed), alpha = bladeAngle + airflowAngle;
      let CL = this.CL0 + this.CLPerRadian * alpha;
      let CD = this.CD0 + CL * CL * this.CDInducedMultiplier / (PI * aspect);
      let sep = 0;
      if (alpha > stallHigh) sep = Math.min((alpha - stallHigh) / stallRange, 1);
      else if (alpha < stallLow) sep = Math.min(-(alpha - stallLow) / stallRange, 1);
      if (sep !== 0) { CL = CL * (1 - sep) + sep * 1.1 * Math.sin(2 * alpha); CD = CD * (1 - sep) + sep * Math.abs(1.5 * Math.sin(alpha)); }
      const dp = 0.5 * rho * airSpeedSq, area = this.bladeChord * dR, lift = area * dp * CL, drag = area * dp * CD;
      const cosA = Math.cos(airflowAngle), sinA = Math.sin(airflowAngle);
      propForce += lift * cosA + drag * sinA; propTorque -= (-drag * cosA + lift * sinA) * r;
    }
    propForce *= this.numBlades; propTorque *= this.numBlades;
    // prop wash by momentum theory
    if (propForce !== 0) {
      const area = PI * this.radius ** 2, reverse = propForce < 0;
      let F = propForce, vv = v0;
      if (reverse) { F = -F; vv = -vv; }
      let washSpeed = 0.5 * (-vv + Math.sqrt(vv * vv + 2 * F / (rho * area)));
      if (reverse) washSpeed = -washSpeed;
      this.lastWash = thrustDir.clone().multiplyScalar(-washSpeed); this.lastWashAngVel = thrustDir.clone().multiplyScalar(this.W * this.washRotationFraction);
    } else { this.lastWash.set(0, 0, 0); this.lastWashAngVel.set(0, 0, 0); }
    // engine: torque while below the demanded speed, friction always
    let engineTorque = 0;
    const speedFrac = this.maxW > 0 ? this.W / this.maxW : 0;
    if (speedFrac < throttle) engineTorque = this.maxTorque * clamp(throttle - speedFrac, -1, 1) * 5;
    let friction = this.frictionTorque;
    if (dt > 0) {
      friction = Math.min(friction, Math.abs(this.W) * this.inertia / dt);
      if (engineTorque > 0) engineTorque = Math.min(engineTorque, (throttle * this.maxW - this.W) * this.inertia / dt);
    }
    engineTorque += speedFrac > 0 ? -friction : friction;
    this.W += (engineTorque - propTorque) / this.inertia * dt;
    if (this.W < this.minW) this.W = this.minW;
    this.angle += this.W * dt;
    this.electricPower = Math.max(0, engineTorque) * Math.max(this.W, 0) / this.electricEfficiency + (throttle > 0.01 ? 1.5 : 0);   // W drawn from the battery
    this.thrust = propForce; this.aeroTorque = propTorque;
    plane.applyForceAtPoint(thrustDir.clone().multiplyScalar(propForce), this.tm.p);
    plane.applyTorque(thrustDir.clone().multiplyScalar(-engineTorque * this.aeroTorqueScale));
    if (Math.abs(this.W) > 0.01) {                                       // roll/pitch damping from the spinning prop
      const angVel = plane.angularVelocityWorld(); angVel.sub(thrustDir.clone().multiplyScalar(angVel.dot(thrustDir)));
      const kd = 2 * PI * PI * this.solidity, scale = -kd * rho * 0.5 * this.W * this.W * this.radius ** 5;
      plane.applyTorque(V(scale * Math.atan(angVel.x / this.W), scale * Math.atan(angVel.y / this.W), scale * Math.atan(angVel.z / this.W)));
    }
    {                                                                    // drag from air flow in the prop plane
      const tangent = velRelWind.clone().sub(thrustDir.clone().multiplyScalar(velRelWind.dot(thrustDir)));
      const area = PI * this.radius ** 2, T = Math.abs(propForce), w0 = Math.sqrt(T / (2 * rho * area));
      plane.applyForceAtPoint(tangent.multiplyScalar(-this.propDiskAreaScale * rho * area * w0), this.tm.p);
    }
    plane.addExtraAngularMomentum(thrustDir.clone().multiplyScalar(this.W * this.inertia));   // gyroscopic precession
  }
}
