// Run: node test/audit.test.js. Regression tests for the rule bugs found by the audit (docs/audit-and-roadmap.md): R1, R2, R3, R5, N4.
import { Fight } from "../shared/fight.js";
import { Arena } from "../shared/arena.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";
import { DEFAULT_BUILD } from "../shared/workshop.js";

let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
const air = (z = 20, x = 0) => ({ airborne: true, pos: [x, 10, z], streamerIntact: true });
const ground = (z = 5, x = 0) => ({ airborne: false, pos: [x, 0.08, z], streamerIntact: true });

// R2 (§4.2.1, §4.7, §4.10): a plane launched in preparation and still flying when the flight starts counts as launched at t = 0.
{ const f = new Fight({ prep: 5, ready: 2, flight: 60 });
  f.addPilot("a"); f.addPilot("b"); f.start(); f.setReady("a"); f.setReady("b");
  const run = (s, rep) => { for (let i = 0; i < Math.round(s / 0.1); i++) f.step(0.1, rep); };
  run(0.3, { a: air(), b: ground() });                                         // prep -> ready, a flies a test flight
  run(2.2, { a: air(), b: ground() });                                         // ready -> flight, a still airborne
  const a = f.pilots.get("a");
  check("airborne at the start of the flight counts as launched (§4.2.1)", f.phase === "flight" && a.launches === 1 && a.lastLaunchT === 0, `launches=${a.launches} lastLaunchT=${a.lastLaunchT}`);
  run(61, { a: air(), b: air(30) }); run(1, { a: ground(8), b: ground(8, 3) });
  check("such a plane still gets protection and landing bonuses (§4.10, §4.7)", f.phase === "results" && a.protectionBonus === 50, `protection=${a.protectionBonus} landing=${a.landingBonus}`); }

// R5 (§4.11): several streamers cut in one attack count as one cut, and every victim still loses protection.
{ const f = new Fight({ prep: 1, ready: 1, flight: 60 });
  for (const id of ["a", "b", "c"]) f.addPilot(id); f.start(); for (const id of ["a", "b", "c"]) f.setReady(id);
  const rep = { a: air(), b: air(30), c: air(40) };
  for (let i = 0; i < 25; i++) f.step(0.1, rep);
  const r1 = f.cut("a", "b"), r2 = f.cut("a", "c");
  check("two victims in one attack = one cut (§4.11)", r1 && !r2 && f.pilots.get("a").cuts === 1, `cuts=${f.pilots.get("a").cuts}`);
  check("both victims lose their protection", f.pilots.get("b").protectionLost && f.pilots.get("c").protectionLost, "b and c"); }

// Arena-level checks with humans reporting poses.
function human(seed, opts = {}) {
  const a = new Arena({ params: ESA_WWII, rounds: 2, seed, fight: { prep: 1, ready: 1, flight: 20 } });
  const s1 = a.addHuman("a", "A", "spitfire", opts.buildA), s2 = a.addHuman("b", "B", "spitfire");
  const pose = (id, z, airborne = true) => a.setPose(id, { pos: [0, 10, z], quat: [0, 0, 0, 1], airborne, held: false, vel: [0, 0, 15] });
  const run = (s, f) => { for (let i = 0; i < Math.round(s * 30); i++) { f && f(i); a.step(1 / 30); } };
  return { a, s1, s2, pose, run };
}
const toFlight = (h) => { h.a.fight.setReady("a"); h.a.fight.setReady("b"); h.a.fight.start(); h.run(3, () => { h.pose("a", 20, false); h.pose("b", 20, false); }); };
const toResults = (h) => { h.run(40, () => { h.pose("a", 20, false); h.pose("b", 20, false); }); };

// R1 (§6): an illegal build scores 0 in every fight of the contest, not only the first.
{ const h = human(1, { buildA: { ...DEFAULT_BUILD, ballastG: 250 } });
  toFlight(h); toResults(h);
  check("illegal build is 0 in round 1 (§6)", h.a.fight.phase === "results" && h.a.fight.score(h.a.fight.pilots.get("a")) === 0, `phase=${h.a.fight.phase}`);
  h.a.restart();
  check("illegal build stays illegal in round 2 (§6)", h.a.fight.pilots.get("a").illegal === true, `${h.a.fight.pilots.get("a").illegal}`); }

// R3 (§4.9): crossings count over the whole contest; the second one disqualifies, also across fights.
{ const h = human(2);
  toFlight(h);
  const cross = () => { h.run(0.5, () => { h.pose("a", 10); h.pose("b", 20); }); h.run(0.5, () => { h.pose("a", -1); h.pose("b", 20); }); };
  cross();
  check("first crossing in round 1: penalty, no DQ", h.a.fight.pilots.get("a").crossings === 1 && !h.a.fight.pilots.get("a").disqualified, `c=${h.a.fight.pilots.get("a").crossings}`);
  toResults(h); h.a.restart();
  const p2 = h.a.fight.pilots.get("a");
  check("round 2 remembers the earlier crossing (§4.9)", p2.priorCrossings === 1 && p2.crossings === 0, `prior=${p2.priorCrossings}`);
  h.a.fight.setReady("a"); h.a.fight.setReady("b"); h.a.fight.start(); h.run(3, () => { h.pose("a", 20, false); h.pose("b", 20, false); });
  cross();
  check("second crossing of the contest (round 2) disqualifies (§4.9)", p2.disqualified, `dq=${p2.disqualified}`);
  toResults(h); h.a.restart();
  check("a disqualified pilot stays out of the next fights", h.a.fight.pilots.get("a").disqualified === true, "dq carried");
  const fin = h.a; fin.fightNo = fin.rounds; fin.recorded = true; fin.restart();
  check("a new contest clears crossings and disqualification", !fin.fight.pilots.get("a").disqualified && fin.fight.pilots.get("a").priorCrossings === 0, "reset"); }

// N4: a human who stops reporting (closed tab) is treated as down after 1 s, no frozen plane collecting flight time.
{ const h = human(3);
  toFlight(h);
  h.run(2, () => { h.pose("a", 20); h.pose("b", 20); });
  const before = h.a.fight.pilots.get("a").airSeconds;
  h.run(10, () => { h.pose("b", 20); });                                          // a stops reporting
  const pa = h.a.fight.pilots.get("a");
  check("silent human is no longer airborne (N4)", !pa.airborne && pa.airSeconds - before < 2, `airborne=${pa.airborne} extra=${(pa.airSeconds - before).toFixed(1)} s`); }

// Contest room (strict): the advanced physics overrides are dropped on the server, a normal room keeps them.
{ const b = { ...DEFAULT_BUILD, paramOverrides: { "settings.dragScale": 1.5 } };
  const ov = (strict) => new Arena({ params: ESA_WWII, strict, seed: 1 }).addHuman("a", "A", "spitfire", b).params.build.paramOverrides;
  check("strict room drops physics overrides, normal room keeps them", ov(true) === undefined && ov(false)?.["settings.dragScale"] === 1.5, `strict=${JSON.stringify(ov(true))} normal=${JSON.stringify(ov(false))}`); }

// Anti-cheat basics (N3, N8): malformed reports, teleports, fake flags.
{ const h = human(4); toFlight(h);
  h.run(1, () => { h.pose("a", 20); h.pose("b", 20); });
  const before = h.a.slots.get("a").cur.pos.join();
  h.a.setPose("a", { pos: [NaN, 10, 20], quat: [0, 0, 0, 1], airborne: true }); h.a.setPose("a", { pos: [0, 10, 20], quat: [0, 0, 0, 0] }); h.a.setPose("a", null); h.a.setPose("a", { pos: [0, 10], quat: [0, 0, 0, 1] });
  check("malformed pose reports are ignored", h.a.slots.get("a").cur.pos.join() === before && h.a.slots.get("a").badPoses === 4, `bad=${h.a.slots.get("a").badPoses}`);
  h.a.step(1 / 30); h.a.setPose("a", { pos: [400, 10, 20], quat: [0, 0, 0, 1], airborne: true, held: false });
  check("a teleport is ignored", h.a.slots.get("a").cur.pos[0] === 0, `x=${h.a.slots.get("a").cur.pos[0]}`); }
{ const h = human(5); toFlight(h);                                                 // fake airborne:false while crossing the line still costs -200
  const pz = (z) => h.a.setPose("a", { pos: [0, 10, z], quat: [0, 0, 0, 1], airborne: false, held: false, vel: [0, 0, 15] });
  h.run(0.5, () => { pz(10); h.pose("b", 20); }); h.run(0.5, () => { pz(-1); h.pose("b", 20); });
  check("claiming not airborne does not avoid the safety line (§4.9)", h.a.fight.pilots.get("a").crossings === 1, `crossings=${h.a.fight.pilots.get("a").crossings}`); }
{ const h = human(6); toFlight(h);
  h.run(3, () => { h.a.setPose("a", { pos: [0, 0.05, 20], quat: [0, 0, 0, 1], airborne: true, held: false }); h.pose("b", 20); });
  check("airborne claimed while sitting on the ground earns no flight time", h.a.fight.pilots.get("a").airSeconds === 0, `${h.a.fight.pilots.get("a").airSeconds}`);
  h.run(3, () => { h.a.setPose("a", { pos: [0, 12, 20], quat: [0, 0, 0, 1], airborne: true, held: true, vel: [0, 0, 15] }); h.pose("b", 20); });
  check("held while flying is not honoured (no free streamer reset or invulnerability)", h.a.slots.get("a").wasHeld === false && h.a.fight.pilots.get("a").airSeconds > 2, `wasHeld=${h.a.slots.get("a").wasHeld}, air=${h.a.fight.pilots.get("a").airSeconds.toFixed(1)}`); }

// Seeded arena: same seed, same bot VTX and channels.
{ const mk = (seed) => { const a = new Arena({ params: ESA_WWII, seed }); for (let i = 0; i < 4; i++) a.addBot(); return [...a.slots.values()].map((s) => `${s.vtx.mw}/${s.vtx.ch}`).join(","); };
  check("seeded arena is repeatable", mk(7) === mk(7) && mk(7) !== mk(8), mk(7)); }
process.exit(fail ? 1 : 0);
