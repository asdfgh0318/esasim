// Run: node test/series.test.js. A contest: 2 rounds + final with bots, points add up (ESA §4.1), winner after the final, tie-break (§4.16).
import { Arena } from "../shared/arena.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";

let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
const a = new Arena({ params: ESA_WWII, rounds: 2, seed: 1, fight: { prep: 1, ready: 1, flight: 45 } });
for (let i = 0; i < 3; i++) a.addBot("Bot" + (i + 1));
const labels = [], totals = [];
for (let f = 0; f < 3; f++) {
  a.fight.start();
  labels.push(a.label());
  let t = 0; while (a.fight.phase !== "results" && t < 200) { a.step(1 / 30); t += 1 / 30; }
  totals.push({ ...a.done[a.fightNo].scores });
  if (f < 2) { check(`fight ${f + 1} recorded`, a.recorded && Object.keys(a.done[f].scores).length === 3, a.label()); a.restart(); }
}
check("labels: round 1/2, round 2/2, final", labels.join("|") === "Round 1/2|Round 2/2|Final", labels.join("|"));
const w = a.winner();
const sum = {}; for (const t of totals) for (const [id, v] of Object.entries(t)) sum[id] = (sum[id] || 0) + v;
const best = Object.keys(sum).sort((x, y) => sum[y] - sum[x])[0];
check("winner has the highest total of all fights (§4.1)", w && (sum[w.id] === sum[best]), `${w?.name} ${w?.total}, sums ${JSON.stringify(sum)}`);
check("prior totals before the final = first two fights", Object.entries(a.prior()).every(([id, v]) => v === totals[0][id] + totals[1][id]), JSON.stringify(a.prior()));
a.restart();
check("after the final a new contest starts", a.fightNo === 0 && a.done.length === 0 && a.label() === "Round 1/2", a.label());

// Bots fly in every round, not only the first (regression: launchAt of the previous fight kept them on the ground until its end), also after "End match".
{ const c = new Arena({ params: ESA_WWII, rounds: 3, seed: 2, fight: { prep: 1, ready: 1, flight: 40 } }); for (let i = 0; i < 2; i++) c.addBot("B" + i);
  const airborneIn = (secs) => { let n = 0, t = 0; while (t < secs) { c.step(1 / 30); t += 1 / 30; if (c.fight.phase === "flight" && [...c.slots.values()].every((x) => x.airborne)) return true; } return false; };
  c.fight.start(); const first = airborneIn(25);
  let t = 0; while (c.fight.phase !== "results" && t < 90) { c.step(1 / 30); t += 1 / 30; }
  for (const x of c.slots.values()) x.launchAt = 200;                                  // as after a crash and respawn late in the fight
  c.restart(); c.fight.start(); const second = airborneIn(25);
  c.restart(); c.fight.start(); for (let i = 0; i < 30 * 12; i++) c.step(1 / 30); for (const x of c.slots.values()) x.launchAt = 150; c.restart(); c.fight.start(); const afterAbort = airborneIn(25);   // abort in mid-fight, then start again
  check("bots fly in round 1, in round 2 and after an aborted match", first && second && afterAbort, `round 1 ${first}, round 2 ${second}, after abort ${afterAbort}`); }

// Tie-break: equal totals, the better final wins (§4.16).
const b = new Arena({ params: ESA_WWII, rounds: 1, fight: {} });
b.fightNo = 1; b.recorded = true; b.done = [{ scores: { x: 100, y: 200 }, names: { x: "X", y: "Y" } }, { scores: { x: 200, y: 100 }, names: { x: "X", y: "Y" } }];
check("tie on totals: better final wins (§4.16)", b.winner()?.id === "x", `${b.winner()?.name}`);
process.exit(fail ? 1 : 0);
