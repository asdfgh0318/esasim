// Adapter: the PicaSim-derived aeroplane behind the same interface as shared/flight.js (class Plane), so the client, the server
// arena, the bots and the tests do not care which physics is underneath. ESASIM's frame: x = the plane's left, y up, z forward
// (three.js, right-handed). PicaSim's frame inside shared/picasim/: X forward, Y left, Z up. v_ours = (Y, Z, X).
// Derived in part from PicaSim by Danny Chapman, PolyForm Noncommercial 1.0.0 (see NOTICE).
import * as THREE from "three";
import { PicaAeroplane, resolveDef } from "./aeroplane.js";
import { CH } from "./components.js";

const toP = (v, o = new THREE.Vector3()) => o.set(v.z, v.x, v.y);       // ours -> PicaSim
const toO = (v, o = new THREE.Vector3()) => o.set(v.y, v.z, v.x);       // PicaSim -> ours
const qToP = (q, o = new THREE.Quaternion()) => o.set(q.z, q.x, q.y, q.w);
const qToO = (q, o = new THREE.Quaternion()) => o.set(q.y, q.z, q.x, q.w);
const SUB = 1 / 600;                                                    // internal step: the small, light planes need a short step

// Sign conventions: our inputs are elevator +1 = stick back (nose up), aileron +1 = roll right, rudder +1 = yaw right.
// PicaSim channels: see SIGNS (found by test/picasim.test.js).
export const SIGNS = { aileron: 1, elevator: -1, rudder: 1 };

export class PicaPlane {
  constructor(params) {
    this.p = params;
    this.aero = new PicaAeroplane(resolveDef(params.def));
    this.pos = new THREE.Vector3(0, 0.08, 0); this.vel = new THREE.Vector3(); this.quat = new THREE.Quaternion(); this.omega = new THREE.Vector3();
    this.input = { throttle: 0, elevator: 0, aileron: 0, rudder: 0 };
    this.onGround = true; this.held = true; this.wind = new THREE.Vector3();
    this.energyWh = params.batteryWh ?? Infinity; this.airspeed = 0; this.alpha = 0; this.beta = 0;
    this._push();
  }
  get battery01() { return Number.isFinite(this.energyWh) ? Math.max(0, this.energyWh / this.p.batteryWh) : 1; }
  refuel() { this.energyWh = this.p.batteryWh ?? Infinity; this.aero.batteryEmpty = false; }

  _push() {                                                             // our pos/quat/vel -> the aeroplane (used while held and at launch)
    const q = qToP(this.quat); this.aero.setPose(toP(this.pos), q);
    this.aero.comVel.copy(toP(this.vel)); this.aero.omegaB.set(0, 0, 0);
  }
  _pull() {                                                             // the aeroplane -> our pos/quat/vel/omega
    toO(this.aero.modelPos(), this.pos); qToO(this.aero.q, this.quat); toO(this.aero.comVel, this.vel);
    toO(this.aero.omegaB, this.omega); this.onGround = this.aero.onGround || this.aero.com.z < 0.03;
  }

  // Hand launch (ESA §4.4): released at 1.5 m, thrown forward and slightly up.
  launch(speed = 9, pitchUp = 0.2) {
    if (!this.held) return;
    this.held = false; this.onGround = false;
    this.pos.y = Math.max(this.pos.y, 1.5);
    this.quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitchUp));
    this.vel.set(0, 0, speed).applyQuaternion(this.quat);
    this._push();
  }

  step(dt) {
    if (this.held) { this._push(); return; }
    const n = Math.max(1, Math.ceil(dt / SUB)), h = dt / n, u = this.input, a = this.aero;
    a.controls[CH.AILERON] = SIGNS.aileron * Math.max(-1, Math.min(1, u.aileron));
    a.controls[CH.ELEVATOR] = SIGNS.elevator * Math.max(-1, Math.min(1, u.elevator));
    a.controls[CH.RUDDER] = SIGNS.rudder * Math.max(-1, Math.min(1, u.rudder));
    a.controls[CH.THROTTLE] = Math.max(0, Math.min(1, u.throttle));
    a.batteryEmpty = this.energyWh <= 0;
    toP(this.wind, a.windVec);
    for (let i = 0; i !== n; i++) {
      a.step(h);
      if (Number.isFinite(this.energyWh)) this.energyWh -= a.electricPower * h / 3600;
    }
    this._pull();
    // air data for the HUD and the bots: air-relative velocity of the CG in the body frame (ours: x left, y up, z forward)
    const vb = this.vel.clone().sub(this.wind).applyQuaternion(this.quat.clone().invert());
    this.airspeed = vb.length(); this.alpha = Math.atan2(-vb.y, vb.z); this.beta = Math.atan2(vb.x, Math.hypot(vb.y, vb.z));
  }
}
