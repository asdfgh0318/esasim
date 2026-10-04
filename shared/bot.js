// Simple pursuit pilot on top of shared/flight.js: lead pursuit, bank to turn, stays inside the flight zone,
// never goes near the safety line (ESA §4.9), avoids the ground. All gains are DESIGN, tuned in test/bot.test.js.
import * as THREE from "three";
import { FIELD } from "./rules.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX_BANK = 1.0;                                                       // rad, about 57 degrees
const CENTER = new THREE.Vector3(0, 10, 34);                                // the fight happens over the landing field and just beyond it
const _fwd = new THREE.Vector3(), _inv = new THREE.Quaternion(), _d = new THREE.Vector3(), _up = new THREE.Vector3(), _aim = new THREE.Vector3();

export class BotPilot {
  constructor({ skill = 0.7, seed = 1 } = {}) {
    this.skill = skill; this.breakSide = seed % 2 ? 1 : -1; this.n1 = 0; this.n2 = 0; this.t = 0; this.rng = seed * 9301 + 49297;
  }
  _rand() { this.rng = (this.rng * 9301 + 49297) % 233280; return this.rng / 233280 - 0.5; }

  // enemies: [{ pos: Vector3, vel: Vector3 }] airborne opponents.
  control(plane, enemies, dt, landing = false) {
    this.t += dt;
    const pos = plane.pos, speed = Math.max(plane.vel.length(), 5);
    let target = null, best = Infinity;
    for (const e of enemies) { const d = pos.distanceTo(e.pos); if (d < best) { best = d; target = e; } }
    // Defence: club and ace bots break away when an enemy sits close behind them (a streamer is only safe while nobody is on the tail).
    let threat = null;
    if (!landing && this.skill >= 0.6) for (const e of enemies) {
      _d.copy(e.pos).sub(pos); const dist = _d.length(); if (dist > 13 || dist < 0.5) continue;
      _fwd.set(0, 0, 1).applyQuaternion(plane.quat);
      if (_d.dot(_fwd) / dist < -0.35) { threat = e; break; }                     // the enemy is in my rear hemisphere
    }
    const zone = FIELD.flightZone;
    // Predictive boundary: where will I be in 1.5 s? Turn radius is about 13 m and stalls throw the plane around, so keep a wide margin from the safety line (z = 0).
    const fx = pos.x + plane.vel.x * 1.5, fz = pos.z + plane.vel.z * 1.5, fy = pos.y + plane.vel.y * 1.4;
    const out = Math.abs(fx) > zone.w * 0.3 || fz < 30 || pos.z < 24 || fz > zone.d * 0.92 || pos.y > 20;
    const goAround = landing && (pos.z < 28 || (plane.vel.z < 0 && pos.z < 38));     // too close to the line while landing: power on, turn away
    if (goAround) _aim.set(0, 14, 52);
    else if (landing) _aim.set(0, 0, 42);                                          // bots land beyond the landing field, away from the safety line; the +20 landing bonus (§4.7) is for humans
    else if (threat && !out) { _fwd.set(0, 0, 1).applyQuaternion(plane.quat); _up.set(1, 0, 0).applyQuaternion(plane.quat).multiplyScalar(this.breakSide); _aim.copy(pos).addScaledVector(_fwd, 8).addScaledVector(_up, 18); }   // hard break to the chosen side
    else if (target && !out) _aim.copy(target.pos).addScaledVector(target.vel, clamp(best / speed, 0, 1.0) * Math.min(1, 0.4 + 0.86 * this.skill))   // club and ace bots lead fully, easy bots aim behind the target;
    else _aim.copy(CENTER);
    if (!landing) { _aim.y = clamp(_aim.y, 7, 16); if (_aim.z < 30 && !out) _aim.z = 30; }                                  // never aim near the safety line
    const takeoff = pos.y < 7 && plane.airspeed < 13;                      // just thrown: level wings, gentle climb, full power
    const low = !landing && !takeoff && (pos.y < 6 || fy < 5);
    _inv.copy(plane.quat).invert();
    _d.copy(_aim).sub(pos).applyQuaternion(_inv).normalize();
    let rollErr = Math.atan2(_d.x, _d.y);
    const maxBank = out && pos.y > 8 ? 1.4 : MAX_BANK;                       // turning away from the boundary may use a harder bank
    _up.set(0, 1, 0).applyQuaternion(_inv);                                 // bank cap: a hard bank at cruise speed bleeds lift into a dive the plane cannot pull out of at this height
    { const bank = Math.atan2(_up.x, _up.y); rollErr = clamp(rollErr, bank - maxBank, bank + maxBank); }
    let pitchErr = Math.atan2(_d.y, Math.max(_d.z, 0.05));
    if (_d.z < 0) pitchErr = Math.sign(_d.y || 1) * 1.5;
    let elev = clamp(pitchErr * 1.6, -1, 1) * (0.25 + 0.75 * Math.max(0, Math.cos(rollErr)));
    if (takeoff || low) {                                                   // wings level (but still bank gently away from the boundary)
      _up.set(0, 1, 0).applyQuaternion(_inv); rollErr = Math.atan2(_up.x, _up.y);
      if (out && Math.abs(rollErr) < 1.1) rollErr += _d.z > -0.5 ? clamp(_d.x * 1.5, -0.8, 0.8) : (_d.x >= 0 ? 0.8 : -0.8);
      elev = takeoff ? (plane.alpha > 0.15 ? 0 : 0.12) : Math.min(0.7, clamp((0.15 - plane.alpha) * 7, 0, 1));
    }
    _fwd.set(0, 0, 1).applyQuaternion(plane.quat);
    if (elev > 0) elev = Math.min(elev, clamp((0.19 - plane.alpha) * 7, 0, 1));    // angle-of-attack limiter: never pull into the stall
    if (_fwd.y > 0.6) elev = Math.min(elev, 0.2);                           // no steep climbs: they end in a stall
    if (!takeoff && !low && (plane.airspeed < (landing && !goAround ? 8 : 11) || Math.abs(plane.alpha) > 0.3)) {   // stall recovery: wings level, then nose slightly down
      _up.set(0, 1, 0).applyQuaternion(_inv); rollErr = Math.atan2(_up.x, _up.y);
      elev = Math.abs(rollErr) < 1.0 ? clamp(2.5 * (-0.1 - _fwd.y), -1, 1) : 0;
      if (Math.abs(rollErr) < 0.8 && _d.z > -0.5) rollErr += clamp(_d.x * 1.5, -0.5, 0.5);   // keep turning away from the boundary, gently banked
    }
    if (landing) {
      if (_fwd.y < -0.42) elev = Math.max(elev, 0);                          // descent no steeper than about 25 degrees
      if (pos.y < 2.2) { _up.set(0, 1, 0).applyQuaternion(_inv); rollErr = Math.atan2(_up.x, _up.y); elev = plane.vel.y < -1.2 ? 0.25 : 0.0; }   // flare, then let it settle
    }
    const k = 0.15 * (1 - this.skill);                                      // less skilled = noisier sticks
    this.n1 += (this._rand() * 2 - this.n1) * Math.min(1, 2 * dt);
    this.n2 += (this._rand() * 2 - this.n2) * Math.min(1, 2 * dt);
    plane.input.elevator = clamp(elev + this.n1 * k, -1, 1);
    plane.input.aileron = clamp(-(rollErr * 1.5) + this.n2 * k, -1, 1);       // +x is the plane's left, aileron + rolls right
    plane.input.rudder = clamp(-plane.beta * 3, -0.5, 0.5);
    plane.input.throttle = goAround ? 1 : landing ? (pos.y < 12 ? 0 : 0.3) : takeoff || plane.airspeed < 13.5 || best > 15 ? 1 : 0.85;
  }
}
