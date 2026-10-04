// Run: node test/flight.test.js. Prints flight-model behaviour and fails on gross errors.
import * as THREE from "three";
import { Plane } from "../shared/flight.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";
const FW190D = ESA_WWII; // legacy name in this file

const DT = 1 / 240;
const deg = (r) => (r * 180) / Math.PI;
const mk = (pos, speed, throttle) => {
  const pl = new Plane(FW190D);
  pl.pos.set(0, pos, 0); pl.vel.set(0, 0, speed); pl.input.throttle = throttle; pl.onGround = false; pl.held = false;
  return pl;
};
const run = (pl, t, f) => { for (let i = 0; i < t / DT; i++) { f?.(pl, i * DT); pl.step(DT); } };
const euler = (pl) => new THREE.Euler().setFromQuaternion(pl.quat, "YXZ");
let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };

// 1. Full throttle, hands off: terminal speed must stay under the prop pitch speed.
let pl = mk(50, 15, 1); run(pl, 40, (p) => { p.input.elevator = 0; });
check("full-throttle speed < pitch speed", pl.airspeed < pl.pitchSpeed, `${pl.airspeed.toFixed(1)} m/s (pitch speed ${pl.pitchSpeed.toFixed(1)}), climb ${pl.vel.y.toFixed(2)} m/s`);

// 2. Level-flight speed range: speed where throttle holds altitude (pitch trimmed by pilot via elevator).
// Find the slowest steady speed with full throttle, nose up: should be near stall, no divergence.
pl = mk(300, 12, 0); run(pl, 20);
check("power-off glide is stable", Math.abs(deg(euler(pl).x)) < 60 && pl.vel.length() < 40, `speed ${pl.vel.length().toFixed(1)} m/s, pitch ${deg(euler(pl).x).toFixed(0)}°, sink ${pl.vel.y.toFixed(1)} m/s`);

// 3. Pitch rate with full back stick at 15 m/s (target ~100-200 °/s).
pl = mk(80, 15, 0.6); pl.input.elevator = 0; run(pl, 3);
let peak = 0; pl.input.elevator = 1; run(pl, 1.0, (p) => { peak = Math.max(peak, -p.omega.x); });
check("pitch rate with full up", deg(peak) > 60 && deg(peak) < 300, `${deg(peak).toFixed(0)} °/s peak`);

// 4. Roll rate with full aileron (target ~200-400 °/s).
pl = mk(80, 18, 0.6); run(pl, 2); peak = 0; pl.input.aileron = 1; run(pl, 1, (p) => { peak = Math.max(peak, -p.omega.z); });
check("roll rate with full right aileron", deg(peak) > 150 && deg(peak) < 500, `${deg(peak).toFixed(0)} °/s peak`);

// 5. Hand launch (ESA §4.4): thrown at 9 m/s, 11° up, full throttle, hands off, must climb away.
pl = new Plane(FW190D); pl.pos.set(0, 1.5, -3); pl.input.throttle = 1; pl.launch();
let minY = 99; run(pl, 10, (p) => { minY = Math.min(minY, p.pos.y); });
check("hand launch", minY > 0.3 && pl.pos.y > 3, `min height ${minY.toFixed(1)} m, after 10 s y=${pl.pos.y.toFixed(1)} m, ${pl.airspeed.toFixed(1)} m/s`);

// 6. Stall: slow with full back stick must not NaN and must lose height.
pl = mk(40, 10, 0); pl.input.elevator = 1; run(pl, 6);
check("stall is finite", Number.isFinite(pl.pos.y) && Number.isFinite(pl.vel.length()), `y=${pl.pos.y.toFixed(1)} v=${pl.vel.length().toFixed(1)} alpha=${deg(pl.alpha).toFixed(0)}°`);

process.exit(fail ? 1 : 0);
