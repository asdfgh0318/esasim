import * as THREE from "three";

// Fixed-wing flight model, shared by client and server.
// Body axes (three.js object convention): x right, y up, z forward.
// Sign conventions: +omega.x = nose down, +omega.z = right wing up, +omega.y = nose right.
// No stabilisation of any kind (ACES §3.9, applies to ESA by ESA §1.2): sticks command surface deflection, not rates.
const RHO = 1.225, G = 9.81, QREF = 0.5 * RHO * 15 * 15;
const GEAR_HEIGHT = 0.08;
const IN = 0.0254;

export class Plane {
  constructor(p) {
    this.p = p;
    this.pos = new THREE.Vector3(0, GEAR_HEIGHT, 0);
    this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.omega = new THREE.Vector3();          // body frame, rad/s
    this.input = { throttle: 0, elevator: 0, aileron: 0, rudder: 0 }; // elevator +1 = stick back, aileron/rudder +1 = right
    this.onGround = true;
    this.held = true;                          // in the pilot's hand until launch() (ESA §4.4: WWII is hand-launched)
    this.airspeed = 0; this.alpha = 0; this.beta = 0;
    this.wind = new THREE.Vector3();           // world frame; turbulence plugs in here
    this._v = new THREE.Vector3(); this._f = new THREE.Vector3(); this._dq = new THREE.Quaternion();
    this._lift = new THREE.Vector3(); this._fwd = new THREE.Vector3(); this._side = new THREE.Vector3(); this._ax = new THREE.Vector3(); this._e = new THREE.Euler();   // temporaries: no allocation per step
  }

  // Max speed the prop can pull the air: rpm x pitch. ESA has no rpm/pitch limit (§3.5); this is a plane parameter.
  get pitchSpeed() { return this.p.maxRpm * this.p.propPitchIn * IN / 60; }

  // Hand launch (ESA §4.4): released at 1.5 m, thrown forward and slightly up (speed and angle are DESIGN).
  launch(speed = 9, pitchUp = 0.2) {
    if (!this.held) return;
    this.held = false; this.onGround = false;
    this.pos.y = Math.max(this.pos.y, 1.5);
    this.quat.multiply(this._dq.setFromAxisAngle(this._ax.set(1, 0, 0), -pitchUp)); // nose up
    this.vel.set(0, 0, speed).applyQuaternion(this.quat);
    this.omega.set(0, 0, 0);
  }

  step(dt) {
    if (this.held) return;
    const p = this.p, u = this.input;
    const throttle = Math.min(1, Math.max(0, u.throttle));
    // Air-relative velocity in the body frame.
    const vb = this._v.copy(this.vel).sub(this.wind).applyQuaternion(this._dq.copy(this.quat).invert());
    const V = Math.max(vb.length(), 1e-3);
    this.airspeed = V;
    const qbar = 0.5 * RHO * V * V;
    const alpha = Math.atan2(-vb.y, vb.z);
    const beta = Math.atan2(vb.x, Math.hypot(vb.y, vb.z));
    this.alpha = alpha; this.beta = beta;

    // Lift coefficient with a smooth stall into a flat-plate-like curve.
    const aStall = p.alphaStall;
    const clLin = p.cl0 + p.clAlpha * Math.max(-aStall, Math.min(aStall, alpha));
    const k = Math.min(1, Math.max(0, (Math.abs(alpha) - aStall) / 0.15));
    const cl = clLin * (1 - k) + k * 1.0 * Math.sin(2 * alpha);
    const AR = p.span * p.span / p.wingArea;
    const cd = p.cd0 + cl * cl / (Math.PI * p.oswald * AR) + 0.6 * beta * beta + k * 1.2 * Math.sin(alpha) ** 2;

    // Forces in the body frame.
    const f = this._f.set(0, 0, 0);
    const liftDir = this._lift.set(0, vb.z, -vb.y).normalize();         // perpendicular to flow, in the symmetry plane
    f.addScaledVector(liftDir, qbar * p.wingArea * cl);
    f.addScaledVector(vb, -qbar * p.wingArea * cd / V);                   // drag opposes the flow
    f.x += -qbar * p.wingArea * 0.8 * beta;                               // side force
    const vFwd = Math.max(0, vb.z);
    f.z += p.staticThrust * throttle * Math.max(0, 1 - vFwd / (0.95 * this.pitchSpeed)); // thrust fades to zero at pitch speed
    f.applyQuaternion(this.quat).divideScalar(p.mass);
    f.y -= G;

    // Moments. Authority scales with dynamic pressure, with some prop-wash authority at low speed.
    const qr = qbar / QREF;
    const auth = Math.min(3, Math.max(qr, 0.25 * throttle));
    const a = p.authority, s = p.stability, d = p.damping, w = this.omega;
    const accX = -a.pitch * u.elevator * auth + s.pitch * qr * alpha - d.pitch * w.x;
    const accZ = -a.roll * u.aileron * auth + s.dihedral * qr * beta - d.roll * w.z;
    const accY = a.yaw * u.rudder * auth + s.yaw * qr * beta - d.yaw * w.y;
    w.x += accX * dt; w.y += accY * dt; w.z += accZ * dt;

    this.vel.addScaledVector(f, dt);
    this.pos.addScaledVector(this.vel, dt);
    const ang = w.length();
    if (ang > 1e-6) this.quat.multiply(this._dq.setFromAxisAngle(this._v.copy(w).divideScalar(ang), ang * dt)).normalize();
    this._ground(dt);
  }

  _ground(dt) {
    this.onGround = this.pos.y <= GEAR_HEIGHT;
    if (!this.onGround) return;
    this.pos.y = GEAR_HEIGHT;
    if (this.vel.y < 0) this.vel.y = 0;
    // Wheels: strong sideways friction, light rolling friction.
    const fwd = this._fwd.set(0, 0, 1).applyQuaternion(this.quat); fwd.y = 0; fwd.normalize();
    const along = this.vel.dot(fwd);
    const side = this._side.copy(this.vel).addScaledVector(fwd, -along); side.y = 0;
    this.vel.addScaledVector(side, -Math.min(1, 8 * dt));
    this.vel.addScaledVector(fwd, -Math.sign(along) * Math.min(Math.abs(along), 4 * dt));   // belly skid on grass: about 4 m/s² (DESIGN)
    // Gear holds the plane upright, nose may only rotate up.
    const e = this._e.setFromQuaternion(this.quat, "YXZ");
    e.z *= 1 - Math.min(1, 10 * dt);
    e.x = Math.min(0.03, Math.max(-0.45, e.x));
    this.quat.setFromEuler(e);
    this.omega.x = Math.min(0, this.omega.x) * 0.5 + (e.x <= -0.45 ? 0 : 0);
    this.omega.z *= 0.5;
  }
}
