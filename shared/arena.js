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
import { PLANES, BOT_PLANE_IDS as PLANE_IDS } from "./planes/index.js";
import { windAt } from "./wind.js";
import { toParams, validate } from "./workshop.js";
import { randomPower, VTX_POWERS } from "./vtx.js";

const SUB = 1 / 240;                     // flight sub-step
const RESPAWN_DELAY = 4;                 // DESIGN: seconds from touchdown until the model is back in the pilot's hand (§4.6 restart, abstracted)
const fwdOf = (q) => new THREE.Vector3(0, 0, 1).applyQuaternion(q);
// NB: model +x is the plane's physical LEFT (see shared/flight.js); "right" here is that +x axis, used symmetrically (wing span) and to orient the mesh.
const rightOf = (q) => new THREE.Vector3(1, 0, 0).applyQuaternion(q);

// Small seeded generator (mulberry32) so a whole arena run is repeatable in tests; the server seeds it from the clock.
function makeRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const MAX_SPEED = 45;                    // DESIGN: m/s between two reported poses; the fastest bot dive is about 23 m/s
const POSE_TIMEOUT = 1;                  // DESIGN: no pose for 1 s = the model is treated as down (closed tab, lost connection)
// Lag compensation ("favour the shooter", docs/netcode.md). A human attacker sees the other streamers late: the snapshot travels to them
// (one way), is shown INTERP_DELAY in the past (client/main.js INTERP_MS), and their pose needs another one-way trip back. So the server judges
// the attacker's path against the victim's streamer as it was (round trip + INTERP_DELAY) ago, never more than MAX_VIEW_DELAY. Bots: no delay.
export const LAG = { HISTORY: 1.0, INTERP_DELAY: 0.1, MAX_VIEW_DELAY: 0.25, MAX_RTT: 1.0 };   // seconds; all DESIGN values
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// findCut returns the arc along the drawn polyline (wobble makes it a bit longer); convert it to the streamer's own length coordinate
// (points are sampled every `spacing` metres from the tail), so the same cut position applies to the live streamer.
function polyS(poly, arc, spacing) {
  let acc = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const l = d3(poly[i], poly[i + 1]);
    if (arc <= acc + l + 1e-9) return (i + (l > 0 ? (arc - acc) / l : 0)) * spacing;
    acc += l;
  }
  return (poly.length - 1) * spacing;
}

export class Arena {
  constructor({ params, fight = {}, rounds = 3, strict = false, lagComp = true, seed = (Date.now() ^ 0x5bd1e995) >>> 0 }) {
    this.rand = makeRng(seed);
    this.lagComp = lagComp;                                              // false = judge every cut against the live streamers (the old behaviour)
    this.strict = strict;                                                // contest room: the advanced physics editor is off, builds are limited to the workshop's ESA-checked options
    this.params = params;
    // Contest series (ESA §4.1): `rounds` fights, then a final; points of all fights add up (§4.1), ties by the final, then the best single fight (§4.16).
    this.rounds = rounds; this.fightNo = 0; this.done = []; this.recorded = false;
    this.fightCfg = fight;
    this.fight = new Fight(fight);
    this.slots = new Map();
    this.t = 0;
    this.events = [];
  }

  _freeChannel() {                                                       // random channel not used by anyone yet (VISUAL/DESIGN: ESA has no FPV rules; §1.2/§4.17 are about radio transmitter frequencies)
    const used = new Set([...this.slots.values()].map((x) => x.vtx.ch));
    const free = [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => !used.has(c));
    return free.length ? free[Math.floor(this.rand() * free.length)] : Math.floor(this.rand() * 8);
  }

  _geom(pr) { return { noseZ: pr.noseZ, wingLeZ: pr.wingLeZ, span: pr.span, propRadius: pr.propDiaIn * 0.0254 / 2 }; }

  _slot(id, name, bot, type, build, skill = 0.7) {
    let s_illegal = false;
    const p = this.fight.addPilot(id, { name, bot });
    if (!p) return null;
    type = PLANES[type] ? type : null;                                  // no valid type: the arena's default params
    let params = type ? PLANES[type] : this.params, ok = true;
    if (build && this.strict) { build = { ...build }; delete build.paramOverrides; }
    if (build) { params = toParams({ ...build, plane: type || build.plane }); ok = validate(params.build).ok; }
    const mw = bot ? randomPower(this.rand()) : (build?.vtxMw ?? 25), ch = !bot && build && build.vtxCh >= 0 ? build.vtxCh : this._freeChannel();
    p.illegal = !ok; s_illegal = !ok;                                    // workshop check (ESA §3.4, §3.6.2, §6)
    const s = { id, name, bot, type, params, vtx: { mw, ch }, geom: this._geom(params), pit: p.pit, streamer: new Streamer({ seed: p.pit + 1 }), prev: null, cur: null, airborne: false, downT: -1, launchAt: 0, tail: [0, 0, 0], illegal: s_illegal, crossingsTotal: 0, dq: false, poseT: 0, rtt: 0, hist: [] };
    if (bot) { s.plane = createPlane(params); s.ai = new BotPilot({ skill, seed: p.pit + 3, plane: type, tune: this.botTune }); this._home(s); }
    this.slots.set(id, s); return s;
  }
  addHuman(id, name, type, build) { return this._slot(id, name, false, type, build); }
  addBot(name, type, skill = 0.7) { return this._slot("bot-" + (this.slots.size + 1) + "-" + Math.floor(this.rand() * 1e4), name || "Bot", true, type || PLANE_IDS[this.slots.size % PLANE_IDS.length], undefined, skill); }   // skill: easy 0.3, club 0.7, ace 0.95
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
  // Anti-cheat basics (docs/netcode.md): flight stays client-authoritative, so the server only checks that a report is well formed and
  // physically plausible. Message shape, speed between reports, and the "held" flag (plane in the hand at the pilot's own box).
  setPose(id, m) {
    const s = this.slots.get(id); if (!s || s.bot) return;
    const fin = (a, n) => Array.isArray(a) && a.length === n && a.every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e4);
    if (!m || !fin(m.pos, 3) || !fin(m.quat, 4) || Math.hypot(...m.quat) < 1e-6) { s.badPoses = (s.badPoses || 0) + 1; return; }
    const vel = fin(m.vel, 3) ? m.vel : [0, 0, 0], speed = Math.hypot(...vel);
    const nearPit = Math.hypot(m.pos[0] - pitX(s.pit), m.pos[2] - FIELD.pilotLineZ) < 4 && m.pos[1] < 2.5;
    const held = !!m.held && nearPit && speed < 5;                    // a plane in the hand is at its owner's box, not flying
    if (s.cur && !held && !s.wasHeld) {                               // teleport / impossible speed: ignore the report (a lag spike of 2 s resyncs)
      const gap = Math.min(Math.max(this.t - s.poseT, 0.05), 1), d = Math.hypot(m.pos[0] - s.cur.pos[0], m.pos[1] - s.cur.pos[1], m.pos[2] - s.cur.pos[2]);
      if (d > MAX_SPEED * gap + 3 && (s.rejected = (s.rejected || 0) + 1) < 40) return;
    }
    s.rejected = 0;
    const q = new THREE.Quaternion().fromArray(m.quat).normalize();
    s.cur = { pos: m.pos, fwd: fwdOf(q).toArray(), right: rightOf(q).toArray() };
    s.poseT = this.t;
    s.airborne = !!m.airborne && !held && m.pos[1] > 0.2;            // sitting on the ground does not earn flight time
    s.flying = !held && m.pos[1] > 0.6;                               // for the safety line: judged by the reported position whatever the airborne flag says
    s.vel = vel;
    if (held && !s.wasHeld) s.streamer.reset(null);
    s.wasHeld = held;
  }

  // Round-trip time measured by the server (ping/pong in server/index.js), seconds. Clamped so a slow or lying client gains nothing past MAX_VIEW_DELAY.
  setRtt(id, rtt) {
    const s = this.slots.get(id); if (!s || s.bot || !Number.isFinite(rtt)) return;
    s.rtt = Math.min(LAG.MAX_RTT, Math.max(0, rtt));
  }
  // How far in the past this pilot sees the other planes and streamers (seconds). Bots see the present.
  viewDelay(s) { return s.bot ? 0 : Math.min(LAG.MAX_VIEW_DELAY, s.rtt + LAG.INTERP_DELAY); }

  // The victim's streamer polyline as it was at arena time T, from the ~1 s history (interpolated between ticks). Only the current streamer
  // (same `gen`) is used: after a reset the old one is gone, and T is clamped to the oldest point of the new one.
  _rewound(v, T) {
    const h = v.hist.filter((e) => e.gen === v.streamer.gen);
    if (!h.length) return v.streamer.points(this.t);
    if (T <= h[0].t) return h[0].pts;
    const last = h[h.length - 1]; if (T >= last.t) return last.pts;
    let i = h.length - 2; while (i > 0 && h[i].t > T) i--;
    const a = h[i], b = h[i + 1], f = (T - a.t) / (b.t - a.t);
    if (a.pts.length !== b.pts.length) return f < 0.5 ? a.pts : b.pts;
    return a.pts.map((p, k) => [p[0] + (b.pts[k][0] - p[0]) * f, p[1] + (b.pts[k][1] - p[1]) * f, p[2] + (b.pts[k][2] - p[2]) * f]);
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
    for (const s of this.slots.values()) if (!s.bot && (s.airborne || s.flying) && this.t - s.poseT > POSE_TIMEOUT) { s.airborne = false; s.flying = false; }   // alt-tab / dead connection: no frozen plane scoring flight time
    const fl = this.fight, phase = fl.phase;
    const enemiesOf = (me) => [...this.slots.values()].filter((o) => o !== me && o.airborne && (o.bot ? o.plane : o.cur)).map((o) => ({
      pos: o.bot ? o.plane.pos : new THREE.Vector3(...o.cur.pos),
      vel: o.bot ? o.plane.vel : new THREE.Vector3(...(o.vel || [0, 0, 0])),   // humans report their velocity for lead aim
    }));
    for (const s of this.slots.values()) {
      if (!s.bot) continue;
      const pl = s.plane;
      if (pl.held && phase === "flight" && !fl.pilots.get(s.id)?.disqualified && fl.flightT >= s.launchAt && fl.cfg.flight - fl.flightT > 15) { pl.input.throttle = 1; pl.launch(); }
      if (!pl.held) {
        pl.wind.set(...windAt(this.t, pl.pos.x, pl.pos.z));
        s.ai.control(pl, enemiesOf(s), dt, phase === "ended");
        for (let t = 0; t < dt - 1e-9; t += SUB) pl.step(Math.min(SUB, dt - t));
        const air = !pl.onGround && pl.pos.y > 0.2;
        if (s.airborne && !air && s.downT < 0) s.downT = this.t;                 // touchdown / crash
        s.airborne = air;
        if (s.downT >= 0 && this.t - s.downT > RESPAWN_DELAY) { this._home(s); s.launchAt = fl.flightT + 1 + this.rand() * 3; }
      }
      const rec = { pos: pl.pos.toArray(), fwd: fwdOf(pl.quat).toArray(), right: rightOf(pl.quat).toArray() };
      s.prev = s.cur || rec; s.cur = rec;
    }
    for (const s of this.slots.values()) {                                         // tails and streamers
      if (!s.cur) continue;
      this._tail(s); s.streamer.push(s.tail);
      s.hist.push({ t: this.t, gen: s.streamer.gen, pts: s.streamer.points(this.t) });     // history for lag-compensated cuts
      while (s.hist.length > 1 && s.hist[1].t <= this.t - LAG.HISTORY) s.hist.shift();
    }
    const reports = {};
    for (const s of this.slots.values()) if (s.cur) reports[s.id] = { airborne: s.airborne, flying: s.airborne || !!s.flying, pos: s.cur.pos, motor: s.cur.pos.map((v, k) => v + s.cur.fwd[k] * s.geom.noseZ), moving: !s.wasHeld && Math.hypot(...(s.vel || [0, 0, 0])) > 1, streamerIntact: s.streamer.intact };
    // Cuts: every airborne attacker against every other streamer (ESA §4.11), swept between the two last frames. Lag-compensated: a human
    // attacker's path is tested against the victim's streamer as that attacker saw it (now - viewDelay); a hit cuts the LIVE streamer at
    // the same distance from the tail. Only the still-attached part counts (§4.11): a hit beyond the live length (already cut off) is ignored.
    // One attack = one cut is enforced by fight.cut (§4.11).
    if (phase === "flight") {
      for (const a of this.slots.values()) {
        if (!a.airborne || !a.cur || !a.prev || fl.pilots.get(a.id)?.disqualified) continue;
        const delay = this.lagComp ? this.viewDelay(a) : 0;
        for (const v of this.slots.values()) {
          if (v === a || !v.airborne || !v.streamer.head || v.streamer.length < 0.3) continue;   // §4.11: only streamers of models in the air
          const poly = delay > 0 ? this._rewound(v, this.t - delay) : v.streamer.points(this.t);
          const hit = findCut(a.prev, a.cur, a.geom, poly);
          if (!hit) continue;
          const at = polyS(poly, hit.arc, v.streamer.spacing);
          if (at < v.streamer.length) { v.streamer.cut(at); fl.cut(a.id, v.id); }
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
    for (const p of this.fight.pilots.values()) {
      scores[p.id] = this.fight.score(p); names[p.id] = p.name;
      const s = this.slots.get(p.id); if (s) { s.crossingsTotal = p.priorCrossings + p.crossings; s.dq = p.disqualified; }   // §4.9: carried through the contest
    }
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
    const newContest = this.isFinal && this.recorded;
    if (newContest) { this.fightNo = 0; this.done = []; for (const s of this.slots.values()) { s.crossingsTotal = 0; s.dq = false; } } else if (this.recorded) this.fightNo++;   // after the final: a new contest
    this.recorded = false;
    this.fight = new Fight(this.fightCfg);
    for (const s of this.slots.values()) {
      this.fight.addPilot(s.id, { name: s.name || s.id, bot: s.bot, pit: s.pit, priorCrossings: s.crossingsTotal, disqualified: s.dq, illegal: s.illegal });   // §4.9, §6 carried through the contest
      if (s.bot) { this._home(s); s.launchAt = 0; s.downT = -1; } else { s.airborne = false; s.streamer.reset(null); }   // a bot launches as soon as the new fight's flight part starts (launchAt of the last fight was late in the clock and made bots wait until the end)
    }
  }

  snapshot() {
    return {
      t: +this.t.toFixed(2),                                                  // arena clock: the client uses it to fly in the same wind as the server (N9)
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
