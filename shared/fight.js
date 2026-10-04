// One ESA fight: phases, flight time, cuts, penalties, final score. Pure logic, no I/O, runs in Node and browser.
// Rules: ESA 2024 (papers/poland/Regulamin_Aircombat_ESA_2024.pdf); constants in shared/rules.js.
// DESIGN = the rules are silent (listed in docs/rules.md).
import { SCORING, FIGHT, FIELD } from "./rules.js";

export const PHASES = ["lobby", "prep", "ready", "flight", "ended", "results"];
const ATTACK_WINDOW = 2;        // DESIGN: cuts by the same pilot within 2 s, on any streamers, are one attack (§4.11: several cuts in one attack count once)
const ENGAGE_RADIUS = 30;       // DESIGN: "in combat" = within 30 m of an airborne opponent (§4.14)
const READY_SECONDS = 10;       // DESIGN: §4.2.2 "gotowość ma różny czas"
const END_TIMEOUT = 45;         // DESIGN: pilots land after the end signal (§4.2.3), then results

export class Fight {
  constructor(opts = {}) {
    this.cfg = { prep: FIGHT.prepSeconds, ready: READY_SECONDS, flight: FIGHT.flightSeconds, ...opts };
    this.phase = "lobby"; this.clock = 0; this.flightT = 0;
    this.pilots = new Map();
    this.events = [];
  }

  addPilot(id, { name = id, bot = false, pit, priorCrossings = 0, disqualified = false, illegal = false } = {}) {
    if (this.pilots.size >= FIGHT.maxPilots) return null;                       // §4.1
    const taken = new Set([...this.pilots.values()].map((p) => p.pit));
    if (pit === undefined) { pit = 0; while (taken.has(pit)) pit++; }
    const p = {
      id, name, bot, pit, ready: bot,
      airborne: false, wasAirborne: false, crossedField: false,
      airSeconds: 0, launches: 0, lastLaunchT: -1, landedT: -1,
      cuts: 0, protectionLost: false, crossings: 0, priorCrossings, disqualified,           // §4.9 counts crossings "podczas zawodów" (during the whole contest), so earlier fights are carried in
      awayT: 0, warned: false, nonEngagements: 0, landingBonus: 0, protectionBonus: 0,
      streamerIntact: true, lastCutT: undefined, illegal,                       // illegal build stays illegal for the whole contest (§6, same model)
    };
    this.pilots.set(id, p); return p;
  }
  removePilot(id) { this.pilots.delete(id); }
  setReady(id, v = true) { const p = this.pilots.get(id); if (p) p.ready = v; }

  start() { if (this.phase === "lobby" && this.pilots.size >= FIGHT.minPilots) this._to("prep"); }  // §4.1: at least two
  allReady() { return this.pilots.size >= FIGHT.minPilots && [...this.pilots.values()].every((p) => p.ready); }

  _to(phase) { this.phase = phase; this.clock = 0; this.events.push({ type: "phase", phase }); }
  _score(p, pts, why) { p.bonus = (p.bonus || 0) + pts; this.events.push({ type: "points", id: p.id, pts, why }); }

  flightPoints(p) {                                                          // §6: +1 per 3 s, 100 for the full time
    return Math.min(SCORING.flightPointsMax, Math.floor(p.airSeconds / SCORING.flightSecondsPerPoint + 1e-6));
  }
  score(p) {
    if (p.illegal) return 0;                                                   // §6: over the mass or battery limit = 0 points for the round
    return this.flightPoints(p) + p.cuts * SCORING.cut + p.protectionBonus + p.landingBonus
      + p.crossings * SCORING.safetyLine + p.nonEngagements * SCORING.nonEngagement;
  }

  // reports: { [id]: { airborne, pos:[x,y,z], streamerIntact } } from the clients (pose of the plane and its streamer state).
  step(dt, reports = {}) {
    this.clock += dt;
    for (const [id, r] of Object.entries(reports)) this._report(this.pilots.get(id), r, dt);
    if (this.phase === "prep" && (this.clock >= this.cfg.prep || this.allReady())) this._to("ready");
    else if (this.phase === "ready" && this.clock >= this.cfg.ready) { this.flightT = 0; this._to("flight"); this._carryFlights(); }
    else if (this.phase === "flight") {
      this.flightT += dt;
      this._engagement(dt);
      if (this.flightT >= this.cfg.flight) this._to("ended");                // §4.5, §4.2.3
    } else if (this.phase === "ended") {
      const allDown = [...this.pilots.values()].every((p) => !p.airborne);
      if (allDown || this.clock >= END_TIMEOUT) this._finish();
    }
    return this.drain();
  }
  // A model launched during preparation (test flight, §4.2.1) and still flying when the flight part starts counts as launched at t = 0,
  // otherwise it would lose the protection (§4.10) and landing (§4.7) bonuses.
  _carryFlights() { for (const p of this.pilots.values()) if (p.airborne && p.launches === 0) { p.launches = 1; p.lastLaunchT = 0; } }
  drain() { const e = this.events; this.events = []; return e; }

  _report(p, r, dt) {
    if (!p || !r) return;
    const wasAir = p.airborne;
    p.airborne = !!r.airborne && !p.disqualified;
    p.streamerIntact = r.streamerIntact !== false;
    p.pos = r.pos;
    const live = this.phase === "flight";
    const lineActive = this.phase === "prep" || this.phase === "ready" || this.phase === "flight" || this.phase === "ended"; // §2.2.4: all flights
    if (p.airborne && !wasAir) {                                             // launch
      if (live) { p.launches++; p.lastLaunchT = this.flightT; }
      p.crossedField = false; this.events.push({ type: "launch", id: p.id });
    }
    if (live && p.airborne) p.airSeconds += dt;                              // §4.5, §6 flight time points
    if (wasAir && !p.airborne) {                                             // touchdown or crash (§4.13: time stops when the fuselage hits the ground)
      p.landedT = this.flightT;
      if (!p.streamerIntact) p.protectionLost = true;                        // §4.10: shortened/lost after landing = lost
      if (this.phase === "ended" && !p.disqualified) this._landingBonus(p, r.pos);
      this.events.push({ type: "land", id: p.id });
    }
    const grounded = !(p.airborne || r.flying) && r.moving && r.motor;       // §4.9: on the ground the position of the motor counts (a model moving on the ground can cross too)
    if (lineActive && ((p.airborne || r.flying) || grounded) && !p.disqualified && r.pos) {                                 // §4.9 safety line: whole model beyond z = 0 toward the pilots
      const lz = grounded ? r.motor[2] : r.pos[2];
      if (lz >= FIELD.safetyLineZ) p.crossedField = true;
      else if (p.crossedField) {                                             // field side -> pilot side
        p.crossedField = false; p.crossings++;
        const total = p.priorCrossings + p.crossings;                        // §4.9: first crossing during the contest = penalty, second = penalty + disqualified
        this.events.push({ type: "safety", id: p.id, n: total, pts: SCORING.safetyLine });
        if (total >= 2) { p.disqualified = true; p.airborne = false; this.events.push({ type: "disqualified", id: p.id }); }  // §4.9 second crossing
      }
    }
  }

  _landingBonus(p, pos) {
    const lf = FIELD.landingField;
    const inField = pos && pos[2] >= 0 && pos[2] <= lf.d && Math.abs(pos[0]) <= lf.w / 2;       // §2.2.2
    const lateEnough = p.lastLaunchT >= 0 && p.lastLaunchT <= this.cfg.flight - SCORING.landingMinSecondsBeforeEnd; // §4.7
    if (inField && lateEnough && !p.landingBonus) { p.landingBonus = SCORING.landingAfterEnd; this.events.push({ type: "landing-bonus", id: p.id, pts: SCORING.landingAfterEnd }); }
  }

  // Called by the server when a cut is detected: attacker's prop or wing hit the victim's streamer at `arc` metres.
  cut(attackerId, victimId) {
    const a = this.pilots.get(attackerId), v = this.pilots.get(victimId);
    if (!a || !v || this.phase !== "flight" || !a.airborne || a.disqualified) return false;   // §4.11 attacker must be flying
    const last = a.lastCutT;
    v.protectionLost = true;                                                  // the victim loses the streamer whether or not the cut scores
    if (last !== undefined && this.flightT - last < ATTACK_WINDOW) { a.lastCutT = this.flightT; return false; } // several cuts in one attack = one (§4.11)
    a.lastCutT = this.flightT;
    a.cuts++;
    this.events.push({ type: "cut", id: attackerId, victim: victimId, pts: SCORING.cut });
    return true;
  }

  _engagement(dt) {                                                           // §4.14 non-engagement
    const air = [...this.pilots.values()].filter((p) => p.airborne && p.pos);
    for (const p of air) {
      const others = air.filter((q) => q !== p);
      if (!others.length) continue;                                           // nobody to fight: timer paused
      const near = others.some((q) => Math.hypot(q.pos[0] - p.pos[0], q.pos[1] - p.pos[1], q.pos[2] - p.pos[2]) <= ENGAGE_RADIUS);
      if (near) { p.awayT = 0; p.warned = false; continue; }
      p.awayT += dt;
      if (!p.warned && p.awayT >= FIGHT.nonEngagementSeconds) { p.warned = true; p.awayT = 0; this.events.push({ type: "warning", id: p.id }); }
      else if (p.warned && p.awayT >= FIGHT.nonEngagementSeconds) { p.warned = false; p.awayT = 0; p.nonEngagements++; this.events.push({ type: "non-engagement", id: p.id, pts: SCORING.nonEngagement }); }
    }
  }

  _finish() {
    for (const p of this.pilots.values()) {
      if (!p.protectionLost && p.streamerIntact && p.airSeconds >= 10 && p.launches > 0) {   // §4.10: >= 10 s airborne
        p.protectionBonus = SCORING.streamerProtected;
        this.events.push({ type: "protected", id: p.id, pts: SCORING.streamerProtected });
      }
    }
    this._to("results");
  }

  snapshot() {
    return {
      phase: this.phase,
      left: this.phase === "prep" ? this.cfg.prep - this.clock : this.phase === "ready" ? this.cfg.ready - this.clock
        : this.phase === "flight" ? this.cfg.flight - this.flightT : 0,
      pilots: [...this.pilots.values()].map((p) => ({
        id: p.id, name: p.name, bot: p.bot, pit: p.pit, ready: p.ready, airborne: p.airborne, cuts: p.cuts,
        crossings: p.crossings, crossingsTotal: p.priorCrossings + p.crossings, disqualified: p.disqualified, illegal: p.illegal, protectionLost: p.protectionLost, flight: this.flightPoints(p), score: this.score(p),
      })),
    };
  }
}
