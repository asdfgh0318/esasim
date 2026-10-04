// Run: node test/lagcomp.test.js. Lag-compensated cuts ("favour the shooter", docs/netcode.md), headless Arena, no sockets.
// Victim V (human) flies straight along +z at 15 m/s, y = 10; its 10 m streamer (ESA §3.7) trails behind. Attacker A (human) flies along +x
// at 30 m/s and crosses the line x = 0 in exactly one tick (kc), at a chosen distance behind V's tail at that tick.
// In 150 ms the free end moves 2.25 m forward, so a crossing 1 m behind the current free end hits only the streamer as it was 150 ms ago.
import { Arena, LAG } from "../shared/arena.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";

let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
const DT = 1 / 30, quatZ = [0, 0, 0, 1], quatX = [0, Math.SQRT1_2, 0, Math.SQRT1_2];

// behind: metres behind V's tail (at the crossing tick) where A crosses. rtt: A's measured round trip (s). Returns cut events and V's streamer.
function run({ lagComp = true, rtt = 0, behind, precut = null }) {
  const a = new Arena({ params: ESA_WWII, seed: 7, lagComp, fight: { prep: 0.05, ready: 0.05, flight: 60 } });
  a.addHuman("v", "Victim", "spitfire"); a.addHuman("a", "Attacker", "spitfire");
  a.setRtt("a", rtt);
  const tailZ = a.slots.get("v").params.tailZ;
  a.fight.start();
  let k = 0, kc = null, zc = null, events = [], delayUsed = a.viewDelay(a.slots.get("a"));
  const vz = (i) => 0.5 * i;                                                     // 15 m/s at 30 Hz
  for (; k < 400; k++) {
    if (kc === null && a.fight.phase === "flight") { kc = k + 45; zc = vz(kc) + tailZ - behind; }
    if (precut !== null && kc !== null && k === kc - 2) a.slots.get("v").streamer.cut(precut);   // part of the streamer already cut off (live shorter than history)
    a.setPose("v", { pos: [0, 10, vz(k)], quat: quatZ, vel: [0, 0, 15], airborne: true, held: false });
    const ax = kc === null ? -200 : (k - kc) * 1.0;                              // pos.x goes -1 -> 0 on tick kc (nose and wing edge cross x = 0)
    a.setPose("a", { pos: [ax, 10, zc ?? -50], quat: quatX, vel: [30, 0, 0], airborne: true, held: false });
    events.push(...a.step(DT));
    if (kc !== null && k > kc + 10) break;
  }
  const cuts = events.filter((e) => e.type === "cut");
  return { cuts, len: a.slots.get("v").streamer.length, delayUsed, arena: a };
}

// 1. The headline case: 150 ms view delay (rtt 50 ms + 100 ms interpolation), crossing 1 m behind the current free end.
const r0 = run({ lagComp: false, rtt: 0.05, behind: 11 });
check("150 ms delay, no compensation: no cut (the streamer has already moved on)", r0.cuts.length === 0 && r0.len === 10, `${r0.cuts.length} cuts, streamer ${r0.len.toFixed(2)} m`);
const r1 = run({ lagComp: true, rtt: 0.05, behind: 11 });
check("view delay = rtt + interpolation", Math.abs(r1.delayUsed - 0.15) < 1e-9, `${r1.delayUsed.toFixed(3)} s`);
check("150 ms delay, compensated: exactly one fight cut (§4.11)", r1.cuts.length === 1 && r1.cuts[0].id === "a" && r1.cuts[0].victim === "v", `${r1.cuts.length} cuts`);
// 150 ms ago the tail was 2.25 m further back, so the crossing point was 11 - 2.25 = 8.75 m from the tail; the live streamer is cut there.
check("live streamer cut at the same distance from the tail", Math.abs(r1.len - 8.75) < 0.6, `${r1.len.toFixed(2)} m left (expected about 8.75)`);

// 2. No-delay controls: a normal crossing through the live streamer counts with and without compensation, a clear miss never counts.
const c0 = run({ lagComp: false, behind: 5 });
check("control, no compensation, crossing the live streamer: one cut", c0.cuts.length === 1 && Math.abs(c0.len - 5) < 0.6, `${c0.cuts.length} cuts, ${c0.len.toFixed(2)} m left`);
const c1 = run({ lagComp: true, rtt: 0, behind: 5 });
check("control, compensated (100 ms interpolation only): still one cut", c1.cuts.length === 1 && Math.abs(c1.len - (5 - 1.5)) < 0.6, `${c1.cuts.length} cuts, ${c1.len.toFixed(2)} m left (tail was 1.5 m back 100 ms ago)`);
const c2 = run({ lagComp: true, rtt: 0.05, behind: 14 });
check("control, compensated, crossing 4 m behind the free end: no cut", c2.cuts.length === 0, `${c2.cuts.length} cuts`);

// 3. The clamp: a claimed 2 s round trip rewinds at most MAX_VIEW_DELAY (250 ms = 3.75 m of streamer travel here).
const k1 = run({ lagComp: true, rtt: 2, behind: 15 });
check("claimed 2 s delay is clamped", k1.delayUsed === LAG.MAX_VIEW_DELAY, `${k1.delayUsed} s (max ${LAG.MAX_VIEW_DELAY})`);
check("claimed 2 s delay: where the streamer was 1 s ago does not count", k1.cuts.length === 0 && k1.len === 10, `${k1.cuts.length} cuts`);
const k2 = run({ lagComp: true, rtt: 2, behind: 13 });
check("claimed 2 s delay: still judged at 250 ms (3 m behind the free end hits)", k2.cuts.length === 1, `${k2.cuts.length} cuts, ${k2.len.toFixed(2)} m left`);

// 4. Only the attached streamer counts (§4.11): a part cut off after the moment the attacker saw is not cut again.
const p1 = run({ lagComp: true, rtt: 0.05, behind: 11, precut: 6 });
check("hit on an already cut-off part of the rewound streamer does not count", p1.cuts.length === 0 && Math.abs(p1.len - 6) < 1e-9, `${p1.cuts.length} cuts, ${p1.len.toFixed(2)} m left`);

// 5. History is short (about 1 s) and bots are not rewound: an all-bot fight is identical with and without compensation.
const hist = r1.arena.slots.get("v").hist;
check("streamer history kept for about 1 s", hist.length <= Math.ceil(LAG.HISTORY / DT) + 2 && r1.arena.t - hist[0].t <= LAG.HISTORY + DT + 1e-9, `${hist.length} entries, ${(r1.arena.t - hist[0].t).toFixed(2)} s`);
function botFight(lagComp) {
  const a = new Arena({ params: ESA_WWII, seed: 3, lagComp, fight: { prep: 1, ready: 1, flight: 40 } });
  for (let i = 0; i < 3; i++) a.addBot("Bot" + (i + 1));
  a.fight.start();
  const ev = []; for (let t = 0; t < 45; t += DT) ev.push(...a.step(DT));
  return { ev: JSON.stringify(ev), cuts: ev.filter((e) => e.type === "cut").length, delays: [...a.slots.values()].map((s) => a.viewDelay(s)) };
}
const b0 = botFight(false), b1 = botFight(true);
check("bots have no view delay", b1.delays.every((d) => d === 0), JSON.stringify(b1.delays));
check("all-bot fight unchanged by lag compensation", b0.ev === b1.ev, `${b1.cuts} cuts, events identical: ${b0.ev === b1.ev}`);

process.exit(fail ? 1 : 0);
