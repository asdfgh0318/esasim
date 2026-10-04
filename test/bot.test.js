// Run: node test/bot.test.js. Headless fight: bots only, 60 s of prep skipped, a full 300 s flight.
import { Arena } from "../shared/arena.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";

let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
const N = Number(process.env.BOTS || 3);
const a = new Arena({ params: ESA_WWII, fight: { prep: 1, ready: 1 } });
for (let i = 0; i < N; i++) a.addBot("Bot" + (i + 1));
a.fight.start();
const counts = { cut: 0, safety: 0, launch: 0, land: 0 };
let safetyInFlight = 0, landBonus = 0, crashes = 0;
const dt = 1 / 30;
let t = 0, minY = 99, maxSpeed = 0;
while (a.fight.phase !== "results" && t < 500) {
  const ph = a.fight.phase;
  for (const e of a.step(dt)) { if (counts[e.type] !== undefined) counts[e.type]++; if (e.type === "safety" && ph === "flight") safetyInFlight++; if (e.type === "landing-bonus") landBonus++; }
  for (const s of a.slots.values()) if (s.airborne) { minY = Math.min(minY, s.plane.pos.y); maxSpeed = Math.max(maxSpeed, s.plane.vel.length()); }
  t += dt;
}
const snap = a.fight.snapshot();
console.log(`phase=${snap.phase} t=${t.toFixed(0)}s`, JSON.stringify(counts), snap.pilots.map((p) => `${p.name}:${p.score} (flight ${p.flight}, cuts ${p.cuts}, safety ${p.crossings})`).join(" | "), `maxSpeed=${maxSpeed.toFixed(1)}`);
check("fight reaches results", snap.phase === "results", snap.phase);
check("bots launch", counts.launch >= N, `${counts.launch} launches`);
check("bots never cross the safety line during the flight (§4.9)", safetyInFlight === 0, `${safetyInFlight} in flight, ${counts.safety} in total`);
check("all bots are down after the end signal", [...a.slots.values()].every((s) => !s.airborne), "all landed");
check("no safety-line crossing while landing either", counts.safety === 0, `${counts.safety} crossings`);
check("bots fly most of the time", snap.pilots.every((p) => p.flight >= 40), snap.pilots.map((p) => p.flight).join(","));
check("bots score cuts", counts.cut >= 1, `${counts.cut} cuts`);
process.exit(fail ? 1 : 0);
