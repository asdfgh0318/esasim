// One fight arena: fight rules + planes + streamers + cut detection. Used by the server (humans report poses,
// bots are simulated here) and by headless tests (all bots). Client flies its own plane (Adam's decision), the
// arena judges: streamers, cuts and scoring (ESA §4, §6).
import * as THREE from "three";
import { Fight } from "./fight.js";
import { createPlane } from "./plane.js";
import { Streamer } from "./streamer.js";
import { findCut } from "./cut.js";
import { BotPilot } from "./bot.js";
import { FIELD, pitX } from "./rules.js";
import { PLANES, PLANE_IDS } from "./planes/index.js";
import { windAt } from "./wind.js";
import { toParams, validate } from "./workshop.js";
import { randomPower, VTX_POWERS } from "./vtx.js";

const SUB = 1 / 240;                     // flight sub-step
const RESPAWN_DELAY = 4;                 // DESIGN: seconds from touchdown until the model is back in the pilot's hand (§4.6 restart, abstracted)
const fwdOf = (q) => new THREE.Vector3(0, 0, 1).applyQuaternion(q);
// NB: model +x is the plane's physical LEFT (see shared/flight.js); "right" here is that +x axis, used symmetrically (wing span) and to orient the mesh.
const rightOf = (q) => new THREE.Vector3(1, 0, 0).applyQuaternion(q);

export class Arena {
  constructor({ params, fight = {}, rounds = 3 }) {
    this.params = params;
    // Contest series (ESA §4.1): `rounds` fights, then a final; points of all fights add up (§4.1), ties by the final, then the best single fight (§4.16).
    this.rounds = rounds; this.fightNo = 0; this.done = []; this.recorded = false;
    this.fightCfg = fight;
    this.fight = new Fight(fight);
    this.slots = new Map();
    this.t = 0;
    this.events = [];
  }

  _freeChannel() {                                                       // random channel not used by anyone yet (frequency control, ESA §1.2/§4.17)
    const used = new Set([...this.slots.values()].map((x) => x.vtx.ch));
    const free = [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => !used.has(c));
    return free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * 8);
  }

  _geom(pr) { return { noseZ: pr.noseZ, wingLeZ: pr.wingLeZ, span: pr.span, propRadius: pr.propDiaIn * 0.0254 / 2 }; }

  _slot(id, name, bot, type, build) {
    const p = this.fight.addPilot(id, { name, bot });
    if (!p) return null;
    type = PLANES[type] ? type : null;                                  // no valid type: the arena's default params
    let params = type ? PLANES[type] : this.params, ok = true;
    if (build) { params = toParams({ ...build, plane: type || build.plane }); ok = validate(params.build).ok; }
    const mw = bot ? randomPower() : (build?.vtxMw ?? 25), ch = !bot && build && build.vtxCh >= 0 ? build.vtxCh : this._freeChannel();
    p.illegal = !ok;                                                    // workshop check (ESA §3.4, §3.6.2, §6)
    const s = { id, name, bot, type, params, vtx: { mw, ch }, geom: this._geom(params), pit: p.pit, streamer: new Streamer({ seed: p.pit + 1 }), prev: null, cur: null, airborne: false, downT: -1, launchAt: 0, tail: [0, 0, 0] };
    if (bot) { s.plane = createPlane(params); s.ai = new BotPilot({ skill: 0.7, seed: p.pit + 3 }); this._home(s); }
    this.slots.set(id, s); return s;
  }
  addHuman(id, name, type, build) { return this._slot(id, name, false, type, build); }
  addBot(name, type) { return this._slot("bot-" + (this.slots.size + 1) + "-" + Math.floor(Math.random() * 1e4), name || "Bot", true, type || PLANE_IDS[this.slots.size % PLANE_IDS.length]); }
  remove(id) { this.fight.removePilot(id); this.slots.delete(id); }

  _home(s) {                                                   // plane back in the pilot's hand at the pit, new streamer (§4.4)
    const pl = s.plane;
    pl.pos.set(pitX(s.pit), 1.4, FIELD.pilotLineZ); pl.vel.set(0, 0, 0); pl.quat.identity(); pl.omega.set(0, 0, 0);
    pl.held = true; pl.onGround = false; pl.input.throttle = 0; pl.refuel();
    s.airborne = false; s.downT = -1; s.cur = null; s.prev = null;
    this._tail(s); s.streamer.reset(s.tail);
  }

  // Video transmitter switched by a pilot (power and channel), only with the model in the hand (not airborne).
  setVtx(id, m) {
    const s = this.slots.get(id);
    if (!s || s.airborne || !m) return false;
    const mw = VTX_POWERS.includes(Number(m.mw)) ? Number(m.mw) : s.vtx.mw;
    let ch = Math.round(Number(m.ch));
    if (!(ch >= 0 && ch <= 7)) { ch = s.vtx.ch; }
    s.vtx = { mw, ch }; return true;
  }

  // Humans: pose reported by the client { pos:[x,y,z], quat:[x,y,z,w], airborne, held }.
  setPose(id, m) {
    const s = this.slots.get(id); if (!s || s.bot) return;
    const q = new THREE.Quaternion().fromArray(m.quat);
    s.cur = { pos: m.pos, fwd: fwdOf(q).toArray(), right: rightOf(q).toArray() };
    s.airborne = !!m.airborne; s.vel = m.vel || [0, 0, 0];
    if (m.held && !s.wasHeld) s.streamer.reset(null);
    s.wasHeld = !!m.held;
  }

  _tail(s) {
    const pos = s.bot ? s.plane.pos.toArray() : s.cur.pos;
    const f = s.bot ? fwdOf(s.plane.quat).toArray() : s.cur.fwd;
    const tz = s.params.tailZ;
    s.tail = [pos[0] + f[0] * tz, pos[1] + f[1] * tz, pos[2] + f[2] * tz];
  }

  step(dt) {
    this.t += dt; this.events = [];
    this.fight.drain();
    const fl = this.fight, phase = fl.phase;
    const enemiesOf = (me) => [...this.slots.values()].filter((o) => o !== me && o.airborne && (o.bot ? o.plane : o.cur)).map((o) => ({
      pos: o.bot ? o.plane.pos : new THREE.Vector3(...o.cur.pos),
      vel: o.bot ? o.plane.vel : new THREE.Vector3(...(o.vel || [0, 0, 0])),   // humans report their velocity for lead aim
    }));
    for (const s of this.slots.values()) {
      if (!s.bot) continue;
      const pl = s.plane;
      if (pl.held && phase === "flight" && fl.flightT >= s.launchAt && fl.cfg.flight - fl.flightT > 15) { pl.input.throttle = 1; pl.launch(); }
      if (!pl.held) {
        pl.wind.set(...windAt(this.t, pl.pos.x, pl.pos.z));
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
          const hit = findCut(a.prev, a.cur, a.geom, v.streamer.points(this.t));
          if (hit) { v.streamer.cut(hit.arc); fl.cut(a.id, v.id); }
        }
      }
    }
    for (const s of this.slots.values()) s.prev = s.cur;
    this.events.push(...fl.step(dt, reports));
    if (fl.phase === "results" && !this.recorded) this._record();
    return this.events;
  }

  _record() {
    this.recorded = true;
    const scores = {}, names = {};
    for (const p of this.fight.pilots.values()) { scores[p.id] = this.fight.score(p); names[p.id] = p.name; }
    this.done[this.fightNo] = { scores, names };
  }
  get isFinal() { return this.fightNo >= this.rounds; }
  label() { return this.isFinal ? "Final" : `Round ${this.fightNo + 1}/${this.rounds}`; }
  prior() {                                                   // points from the earlier fights of this contest
    const t = {};
    for (let i = 0; i < this.fightNo; i++) for (const [id, pts] of Object.entries(this.done[i]?.scores || {})) t[id] = (t[id] || 0) + pts;
    return t;
  }
  winner() {                                                  // only after the final
    if (!this.isFinal || !this.recorded) return null;
    const total = this.prior(), fin = this.done[this.fightNo].scores;
    for (const [id, pts] of Object.entries(fin)) total[id] = (total[id] || 0) + pts;
    const best = (id) => Math.max(...this.done.map((d) => d?.scores[id] ?? -Infinity));
    const ids = Object.keys(total).sort((a, b) => total[b] - total[a] || (fin[b] ?? -Infinity) - (fin[a] ?? -Infinity) || best(b) - best(a));
    return ids.length ? { id: ids[0], name: this.done[this.fightNo].names[ids[0]], total: total[ids[0]] } : null;
  }

  // New fight with the same pilots (after the results): bots ready, humans must press ready again.
  restart() {
    if (this.isFinal && this.recorded) { this.fightNo = 0; this.done = []; } else if (this.recorded) this.fightNo++;   // after the final: a new contest
    this.recorded = false;
    this.fight = new Fight(this.fightCfg);
    for (const s of this.slots.values()) {
      const p = this.fight.addPilot(s.id, { name: s.name || s.id, bot: s.bot, pit: s.pit });
      if (s.bot) this._home(s); else { s.airborne = false; s.streamer.reset(null); }
    }
  }

  snapshot() {
    return {
      fight: this.fight.snapshot(),
      series: { label: this.label(), fightNo: this.fightNo, rounds: this.rounds, prior: this.prior(), winner: this.winner() },
      planes: [...this.slots.values()].filter((s) => s.cur).map((s) => ({
        id: s.id, pit: s.pit, airborne: s.airborne, bot: s.bot, plane: s.type || "spitfire", spanMm: Math.round(s.params.span * 1000), vtxMw: s.vtx.mw, vtxCh: s.vtx.ch,
        pos: s.cur.pos.map((v) => +v.toFixed(2)), fwd: s.cur.fwd.map((v) => +v.toFixed(3)), right: s.cur.right.map((v) => +v.toFixed(3)),
        streamer: s.streamer.points(this.t).flat().map((v) => +v.toFixed(2)),
      })),
    };
  }
}
