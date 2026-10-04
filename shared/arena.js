// One fight arena: fight rules + planes + streamers + cut detection. Used by the server (humans report poses,
// bots are simulated here) and by headless tests (all bots). Client flies its own plane (Adam's decision), the
// arena judges: streamers, cuts and scoring (ESA §4, §6).
import * as THREE from "three";
import { Fight } from "./fight.js";
import { Plane } from "./flight.js";
import { Streamer } from "./streamer.js";
import { findCut } from "./cut.js";
import { BotPilot } from "./bot.js";
import { FIELD, pitX } from "./rules.js";

const SUB = 1 / 240;                     // flight sub-step
const RESPAWN_DELAY = 4;                 // DESIGN: seconds from touchdown until the model is back in the pilot's hand (§4.6 restart, abstracted)
const fwdOf = (q) => new THREE.Vector3(0, 0, 1).applyQuaternion(q);
const rightOf = (q) => new THREE.Vector3(1, 0, 0).applyQuaternion(q);

export class Arena {
  constructor({ params, fight = {} }) {
    this.params = params;
    this.fightCfg = fight;
    this.fight = new Fight(fight);
    this.slots = new Map();
    this.t = 0;
    this.geom = { noseZ: params.noseZ, wingLeZ: params.wingLeZ, span: params.span, propRadius: params.propDiaIn * 0.0254 / 2 };
    this.events = [];
  }

  _slot(id, name, bot) {
    const p = this.fight.addPilot(id, { name, bot });
    if (!p) return null;
    const s = { id, name, bot, pit: p.pit, streamer: new Streamer({ seed: p.pit + 1 }), prev: null, cur: null, airborne: false, downT: -1, launchAt: 0, tail: [0, 0, 0] };
    if (bot) { s.plane = new Plane(this.params); s.ai = new BotPilot({ skill: 0.7, seed: p.pit + 3 }); this._home(s); }
    this.slots.set(id, s); return s;
  }
  addHuman(id, name) { return this._slot(id, name, false); }
  addBot(name) { return this._slot("bot-" + (this.slots.size + 1) + "-" + Math.floor(Math.random() * 1e4), name || "Bot", true); }
  remove(id) { this.fight.removePilot(id); this.slots.delete(id); }

  _home(s) {                                                   // plane back in the pilot's hand at the pit, new streamer (§4.4)
    const pl = s.plane;
    pl.pos.set(pitX(s.pit), 1.4, FIELD.pilotLineZ); pl.vel.set(0, 0, 0); pl.quat.identity(); pl.omega.set(0, 0, 0);
    pl.held = true; pl.onGround = false; pl.input.throttle = 0;
    s.airborne = false; s.downT = -1; s.cur = null; s.prev = null;
    this._tail(s); s.streamer.reset(s.tail);
  }

  // Humans: pose reported by the client { pos:[x,y,z], quat:[x,y,z,w], airborne, held }.
  setPose(id, m) {
    const s = this.slots.get(id); if (!s || s.bot) return;
    const q = new THREE.Quaternion().fromArray(m.quat);
    s.cur = { pos: m.pos, fwd: fwdOf(q).toArray(), right: rightOf(q).toArray() };
    s.airborne = !!m.airborne;
    if (m.held && !s.wasHeld) s.streamer.reset(null);
    s.wasHeld = !!m.held;
  }

  _tail(s) {
    const pos = s.bot ? s.plane.pos.toArray() : s.cur.pos;
    const f = s.bot ? fwdOf(s.plane.quat).toArray() : s.cur.fwd;
    s.tail = [pos[0] + f[0] * this.params.tailZ, pos[1] + f[1] * this.params.tailZ, pos[2] + f[2] * this.params.tailZ];
  }

  step(dt) {
    this.t += dt; this.events = [];
    this.fight.drain();
    const fl = this.fight, phase = fl.phase;
    const enemiesOf = (me) => [...this.slots.values()].filter((o) => o !== me && o.airborne && (o.bot ? o.plane : o.cur)).map((o) => ({
      pos: o.bot ? o.plane.pos : new THREE.Vector3(...o.cur.pos),
      vel: o.bot ? o.plane.vel : new THREE.Vector3(),            // human velocity is not reported: lead aim uses position only
    }));
    for (const s of this.slots.values()) {
      if (!s.bot) continue;
      const pl = s.plane;
      if (pl.held && phase === "flight" && fl.flightT >= s.launchAt && fl.cfg.flight - fl.flightT > 15) { pl.input.throttle = 1; pl.launch(); }
      if (!pl.held) {
        s.ai.control(pl, enemiesOf(s), dt, phase === "ended");
        for (let t = 0; t < dt - 1e-9; t += SUB) pl.step(Math.min(SUB, dt - t));
        const air = !pl.onGround && pl.pos.y > 0.2;
        if (s.airborne && !air && s.downT < 0) s.downT = this.t;                 // touchdown / crash
        s.airborne = air;
        if (s.downT >= 0 && this.t - s.downT > RESPAWN_DELAY) { this._home(s); s.launchAt = fl.flightT + 1 + Math.random() * 3; }
      }
      const rec = { pos: pl.pos.toArray(), fwd: fwdOf(pl.quat).toArray(), right: rightOf(pl.quat).toArray() };
      s.prev = s.cur || rec; s.cur = rec;
    }
    for (const s of this.slots.values()) {                                         // tails and streamers
      if (!s.cur) continue;
      this._tail(s); s.streamer.push(s.tail);
    }
    const reports = {};
    for (const s of this.slots.values()) if (s.cur) reports[s.id] = { airborne: s.airborne, pos: s.cur.pos, streamerIntact: s.streamer.intact };
    // Cuts: every airborne attacker against every other streamer (ESA §4.11), swept between the two last frames.
    if (phase === "flight") {
      for (const a of this.slots.values()) {
        if (!a.airborne || !a.cur || !a.prev || fl.pilots.get(a.id)?.disqualified) continue;
        for (const v of this.slots.values()) {
          if (v === a || !v.streamer.head || v.streamer.length < 0.3) continue;
          const hit = findCut(a.prev, a.cur, this.geom, v.streamer.points(this.t));
          if (hit) { v.streamer.cut(hit.arc); fl.cut(a.id, v.id); }
        }
      }
    }
    for (const s of this.slots.values()) s.prev = s.cur;
    this.events.push(...fl.step(dt, reports));
    return this.events;
  }

  // New fight with the same pilots (after the results): bots ready, humans must press ready again.
  restart() {
    this.fight = new Fight(this.fightCfg);
    for (const s of this.slots.values()) {
      const p = this.fight.addPilot(s.id, { name: s.name || s.id, bot: s.bot, pit: s.pit });
      if (s.bot) this._home(s); else { s.airborne = false; s.streamer.reset(null); }
    }
  }

  snapshot() {
    return {
      fight: this.fight.snapshot(),
      planes: [...this.slots.values()].filter((s) => s.cur).map((s) => ({
        id: s.id, pit: s.pit, airborne: s.airborne, bot: s.bot,
        pos: s.cur.pos.map((v) => +v.toFixed(2)), fwd: s.cur.fwd.map((v) => +v.toFixed(3)), right: s.cur.right.map((v) => +v.toFixed(3)),
        streamer: s.streamer.points(this.t).flat().map((v) => +v.toFixed(2)),
      })),
    };
  }
}
