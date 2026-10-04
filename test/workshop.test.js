// Run: node test/workshop.test.js. Workshop legality (ESA §3), parameters, battery drain, illegal builds score 0 (§6).
import { validate, toParams, DEFAULT_BUILD, massKg } from "../shared/workshop.js";
import { Plane } from "../shared/flight.js";
import { Fight } from "../shared/fight.js";

let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
const v = (o) => validate({ ...DEFAULT_BUILD, ...o });
check("default build is legal", v({}).ok, `${v({}).massG.toFixed(0)} g`);
check("span 690 mm is illegal (§3.1.2)", !v({ spanMm: 690 }).ok && v({ spanMm: 690 }).problems[0].rule === "§3.1.2", v({ spanMm: 690 }).problems[0]?.text);
check("span 870 mm is illegal (§3.1.2)", !v({ spanMm: 870 }).ok, "870");
check("span 700 and 860 mm are legal", v({ spanMm: 700 }).ok && v({ spanMm: 860, ballastG: 0 }).ok, "limits inclusive");
check("battery 15.5 Wh is illegal (§3.4)", v({ batteryWh: 15.5 }).problems.some((p) => p.rule === "§3.4"), "15.5");
check("battery 15 Wh is legal", v({ batteryWh: 15 }).ok, "15");
check("mass over 450 g is illegal (§3.6.2)", v({ ballastG: 250 }).problems.some((p) => p.rule === "§3.6.2" && /above/.test(p.text)), `${v({ ballastG: 250 }).massG.toFixed(0)} g`);
check("mass under 200 g is illegal (§3.6.2)", v({ batteryWh: 5, ballastG: 0, spanMm: 650 }).problems.some((p) => /below/.test(p.text)), `${v({ batteryWh: 5, ballastG: 0, spanMm: 650 }).massG.toFixed(0)} g`);
check("bigger battery is heavier, bigger span has more wing", massKg({ ...DEFAULT_BUILD, batteryWh: 10 }) < massKg(DEFAULT_BUILD) && toParams({ ...DEFAULT_BUILD, spanMm: 860 }).wingArea > toParams(DEFAULT_BUILD).wingArea, "monotonic");
const big = toParams({ ...DEFAULT_BUILD, propDiaIn: 10, propPitchIn: 4 }), base = toParams(DEFAULT_BUILD);
check("bigger, flatter prop: more static thrust, lower rpm", big.staticThrust > base.staticThrust && big.maxRpm < base.maxRpm, `${base.staticThrust.toFixed(1)} -> ${big.staticThrust.toFixed(1)} N, ${base.maxRpm.toFixed(0)} -> ${big.maxRpm.toFixed(0)} rpm`);

// Battery: drains at full throttle, motor stops at zero, refuel restores it.
const pl = new Plane(base); pl.held = false; pl.pos.set(0, 50, 0); pl.vel.set(0, 0, 15); pl.input.throttle = 1;
let t = 0; while (pl.energyWh > 0 && t < 900) { pl.step(1 / 60); t += 1 / 60; }
check("15 Wh at full throttle lasts about 7.5 minutes", t > 400 && t < 520, `${(t / 60).toFixed(1)} min`);
check("empty battery: no thrust", (() => { const x = pl.vel.length(); for (let i = 0; i < 120; i++) pl.step(1 / 60); return pl.vel.length() < x + 0.5; })(), "dead stick");
pl.refuel(); check("refuel restores the battery", pl.battery01 === 1, "100%");

// Illegal build scores 0 for the round (§6).
const f = new Fight({ prep: 1, ready: 1, flight: 200 }); f.addPilot("a"); f.addPilot("b"); f.pilots.get("a").illegal = true;
f.start(); f.setReady("a"); f.setReady("b");
for (let i = 0; i < 200; i++) f.step(0.1, { a: { airborne: true, pos: [0, 10, 30] }, b: { airborne: true, pos: [0, 10, 30] } });
check("illegal build scores 0 for the round (§6), legal one scores", f.score(f.pilots.get("a")) === 0 && f.score(f.pilots.get("b")) > 0, `a=${f.score(f.pilots.get("a"))} b=${f.score(f.pilots.get("b"))}`);
process.exit(fail ? 1 : 0);
