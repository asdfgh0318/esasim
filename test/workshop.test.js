// Run: node test/workshop.test.js. Workshop legality (ESA §3), parameters, battery drain, illegal builds score 0 (§6).
import { validate, toParams, DEFAULT_BUILD, massKg } from "../shared/workshop.js";
import { createPlane } from "../shared/plane.js";
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
check("the workshop ranges cannot go below the 200 g minimum unreported (§3.6.2)", (() => { const r = v({ batteryWh: 5, ballastG: 0, spanMm: 650 }); return r.massG >= 200 || r.problems.some((p) => /below/.test(p.text)); })(), `lightest build ${v({ batteryWh: 5, ballastG: 0, spanMm: 650 }).massG.toFixed(0)} g`);
check("bigger battery is heavier, bigger span has more wing", massKg({ ...DEFAULT_BUILD, batteryWh: 10 }) < massKg(DEFAULT_BUILD) && toParams({ ...DEFAULT_BUILD, spanMm: 860 }).wingArea > toParams(DEFAULT_BUILD).wingArea, "monotonic");
{ // prop: bigger and flatter gives more static thrust on the same motor (momentum theory), checked with the real physics
  const staticThrust = (b) => { const pl = createPlane(toParams({ ...DEFAULT_BUILD, ...b })); pl.pos.set(0, 200, 0); pl.vel.set(0, 0, 0); pl.held = false; pl._push(); pl.input.throttle = 1;
    for (let i = 0; i < 360; i++) { pl.step(1 / 240); pl.aero.comVel.set(0, 0, 0); pl.aero.omegaB.set(0, 0, 0); pl.aero.com.set(0, 0, 200); } const e = pl.aero.engines[0]; return { T: e.thrust, rpm: e.W * 9.55 }; };
  const a9 = staticThrust({}), a10 = staticThrust({ propDiaIn: 10, propPitchIn: 4 });
  check("bigger, flatter prop: more static thrust, lower rpm", a10.T > a9.T && a10.rpm < a9.rpm, `${a9.T.toFixed(1)} N @ ${a9.rpm.toFixed(0)} rpm -> ${a10.T.toFixed(1)} N @ ${a10.rpm.toFixed(0)} rpm`); }

// Battery: drains at full throttle, motor stops at zero, refuel restores it.
const base2 = toParams(DEFAULT_BUILD), pl = createPlane(base2); pl.held = false; pl.pos.set(0, 800, 0); pl.vel.set(0, 0, 15); pl.input.throttle = 1; pl._push();
let t = 0; while (pl.energyWh > 0 && t < 900) { pl.step(1 / 60); t += 1 / 60; if (pl.pos.y < 100) { pl.aero.com.z = 800; pl.aero.comVel.z = 0; } }
check("15 Wh at full throttle lasts several minutes (a 5 minute flight must be possible)", t > 300 && t < 1200, `${(t / 60).toFixed(1)} min`);
check("empty battery: no thrust", (() => { const x = pl.vel.length(); for (let i = 0; i < 120; i++) pl.step(1 / 60); return pl.vel.length() < x + 0.5; })(), "dead stick");
pl.refuel(); check("refuel restores the battery", pl.battery01 === 1, "100%");

// Illegal build scores 0 for the round (§6).
const f = new Fight({ prep: 1, ready: 1, flight: 200 }); f.addPilot("a"); f.addPilot("b"); f.pilots.get("a").illegal = true;
f.start(); f.setReady("a"); f.setReady("b");
for (let i = 0; i < 200; i++) f.step(0.1, { a: { airborne: true, pos: [0, 10, 30] }, b: { airborne: true, pos: [0, 10, 30] } });
check("illegal build scores 0 for the round (§6), legal one scores", f.score(f.pilots.get("a")) === 0 && f.score(f.pilots.get("b")) > 0, `a=${f.score(f.pilots.get("a"))} b=${f.score(f.pilots.get("b"))}`);
process.exit(fail ? 1 : 0);
