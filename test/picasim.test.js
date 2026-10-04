// Run: node test/picasim.test.js. Behaviour of the PicaSim-derived physics with the ESA plane definitions.
import * as THREE from "three";
import { PicaPlane } from "../shared/picasim/plane.js";
import { buildEsaDef } from "../shared/picasim/esaDef.js";
import { AerofoilDefinition } from "../shared/picasim/aerofoil.js";

let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
const deg = (r) => (r * 180) / Math.PI;
const mk = (b = {}) => new PicaPlane({ def: buildEsaDef(b), batteryWh: b.batteryWh ?? 15, span: 0.8, id: b.plane });
const fly = (pl, h, v, thr) => { pl.pos.set(0, h, 0); pl.vel.set(0, 0, v); pl.quat.identity(); pl.held = false; pl._push(); pl.input.throttle = thr; return pl; };
const run = (pl, t, f, dt = 1 / 240) => { for (let i = 0; i < t / dt; i++) { f?.(pl, i * dt); pl.step(dt); } };
const fwd = (p) => new THREE.Vector3(0, 0, 1).applyQuaternion(p.quat);
const pitchDeg = (p) => deg(Math.asin(fwd(p).y));

// aerofoil data: attached lift slope, stall, reverse flow
{ const a = new AerofoilDefinition({ CL0: 0.2, CLPerDeg: 0.085, positiveAttachedAngle: 9, positiveStallRange: 11, negativeAttachedAngle: -7, negativeStallRange: -9 });
  const cfg = { ext: new THREE.Vector3(0.12, 0.2, 0.01), spanEff: 0.9, controlHalfSpeed: 100 }, ctl = { extraCL: 0, extraCM: 0, extraCD: 0, extraCamber: 0, extraAngle: 0, CDScale: 1 };
  const cl = (d) => a.flightData(cfg, ctl, 6, 15 * 15, d * Math.PI / 180).CL, cd = (d) => a.flightData(cfg, ctl, 6, 15 * 15, d * Math.PI / 180).CD;
  check("aerofoil: CL grows with angle in the attached range", cl(5) > cl(0) && cl(0) > cl(-5), `CL(-5,0,5) = ${cl(-5).toFixed(2)}, ${cl(0).toFixed(2)}, ${cl(5).toFixed(2)}`);
  check("aerofoil: CL0 as defined", Math.abs(cl(0) - 0.2) < 0.03, cl(0).toFixed(3));
  check("aerofoil: stalls (lift drops and drag rises past the stall range, AR 6)", cl(25) <= cl(9) && cd(25) > 5 * cd(5), `CL(9)=${cl(9).toFixed(2)} CL(25)=${cl(25).toFixed(2)}, CD(5)=${cd(5).toFixed(3)} CD(25)=${cd(25).toFixed(2)}`); }

const base = mk();
check("mass and CG", base.aero.mass > 0.36 && base.aero.mass < 0.43 && Math.abs(base.aero.comOffset.x) < 0.03, `${(base.aero.mass * 1000).toFixed(0)} g, CG x ${(base.aero.comOffset.x * 1000).toFixed(0)} mm`);

// power system: static thrust and electrical power at full throttle
{ const pl = fly(mk(), 200, 0, 1); run(pl, 1.5, (p) => { p.aero.comVel.set(0, 0, 0); p.aero.omegaB.set(0, 0, 0); p.aero.com.set(0, 0, 200); }); const e = pl.aero.engines[0];
  check("motor: static thrust at full throttle", e.thrust > 3.5 && e.thrust < 9, `${e.thrust.toFixed(1)} N (${(e.thrust / 9.81 * 1000).toFixed(0)} g), ${(e.W * 9.55).toFixed(0)} rpm, ${e.electricPower.toFixed(0)} W`);
  check("motor: electrical power is plausible for a 15 Wh pack", e.electricPower > 60 && e.electricPower < 200, `${e.electricPower.toFixed(0)} W`); }

// level-flight top speed and cruise at full throttle (DESIGN numbers, not measured on a real plane): a vertical-speed controller holds the height
{ const pl = fly(mk(), 500, 16, 1); const upB = new THREE.Vector3(), inv = new THREE.Quaternion(); let sp = 0, n = 0, maxAlt = 0, minAlt = 1e9;
  run(pl, 40, (p, t) => {
    inv.copy(p.quat).invert(); upB.set(0, 1, 0).applyQuaternion(inv);
    p.input.elevator = Math.max(-0.4, Math.min(0.4, -p.vel.y * 0.05 - (p.pos.y - 500) * 0.005));     // +1 = stick back = nose up; descending (vy < 0) or below the target pulls up
    p.input.aileron = Math.max(-1, Math.min(1, -Math.atan2(upB.x, upB.y) * 1.5));
    if (t > 25) { sp += p.vel.length(); n++; maxAlt = Math.max(maxAlt, p.pos.y); minAlt = Math.min(minAlt, p.pos.y); } });
  const v = sp / n;
  check("level flight at full throttle: a plausible top speed for an ESA foam plane (10-30 m/s)", v > 10 && v < 30 && maxAlt - minAlt < 20, `${v.toFixed(1)} m/s (${(v * 3.6).toFixed(0)} km/h), height band ${(maxAlt - minAlt).toFixed(0)} m`); }

// glide: stable, a reasonable glide ratio, no NaN
{ const pl = fly(mk(), 300, 11, 0); const log = []; run(pl, 16, (p, t) => { if (t > 10 && Math.round(t * 240) % 60 === 0) log.push([p.vel.length(), -p.vel.y]); });
  const v = log.reduce((a, b) => a + b[0], 0) / log.length, s = log.reduce((a, b) => a + b[1], 0) / log.length;
  check("glide: finite, flies slowly with a decent glide ratio", Number.isFinite(v) && s > 0.3 && v / s > 2.7 && v / s < 12 && v < 16, `${v.toFixed(1)} m/s, sink ${s.toFixed(1)} m/s, L/D ${(v / s).toFixed(1)}`); }

// control directions (inputs: elevator +1 = stick back, aileron/rudder +1 = right). The ESASIM frame has +x on the plane's LEFT.
{ const rightWingY = (p) => new THREE.Vector3(-0.4, 0, 0).applyQuaternion(p.quat).y, noseX = (p) => fwd(p).x;
  const a = fly(mk(), 300, 14, 0.5); run(a, 0.5); a.input.aileron = 1; run(a, 0.4);
  check("right aileron drops the right wing", rightWingY(a) < -0.04, `right wing tip height ${rightWingY(a).toFixed(2)} m`);
  const b = fly(mk(), 300, 14, 0.5); run(b, 0.5); b.input.rudder = 1; run(b, 0.8);
  check("right rudder turns the nose right", noseX(b) < -0.01, `nose x ${noseX(b).toFixed(3)} (negative = right)`);
  const c = fly(mk(), 300, 14, 0.5); run(c, 0.5); const p0 = pitchDeg(c); c.input.elevator = 1; run(c, 0.4);
  check("stick back raises the nose", pitchDeg(c) > p0 + 3, `${p0.toFixed(0)} -> ${pitchDeg(c).toFixed(0)} deg`); }

// rates at cruise (the bots and the old flight model assume roughly 150-350 deg/s)
{ const r = fly(mk(), 400, 14, 0.5); run(r, 0.5); let peak = 0; r.input.aileron = 1; run(r, 0.8, (p) => { peak = Math.max(peak, Math.abs(deg(p.omega.z))); });
  check("roll rate with full aileron", peak > 150 && peak < 600, `${peak.toFixed(0)} deg/s`);
  const q = fly(mk(), 400, 14, 0.5); run(q, 0.5); let pk = 0; q.input.elevator = 1; run(q, 0.8, (p) => { pk = Math.max(pk, Math.abs(deg(p.omega.x))); });
  check("pitch rate with full elevator", pk > 70 && pk < 400, `${pk.toFixed(0)} deg/s`); }

// servo throws (issue #20): a bigger throw gives a faster response, a smaller one a slower response
{ const rate = (key, v, ax) => { const q = fly(mk({ [key]: v }), 400, 14, 0.5); run(q, 0.5); q.input[key === "aileronDeg" ? "aileron" : "elevator"] = 1; let pk = 0; run(q, 0.7, (p) => { pk = Math.max(pk, Math.abs(deg(p.omega[ax]))); }); return pk; };
  const r15 = rate("aileronDeg", 15, "z"), r45 = rate("aileronDeg", 45, "z"), e15 = rate("elevatorDeg", 15, "x"), e45 = rate("elevatorDeg", 45, "x");
  check("aileron throw: 45 degrees rolls faster than 15 degrees", r45 > r15 * 1.4, `${r15.toFixed(0)} -> ${r45.toFixed(0)} deg/s`);
  check("elevator throw: 45 degrees pitches faster than 15 degrees", e45 > e15 * 1.3, `${e15.toFixed(0)} -> ${e45.toFixed(0)} deg/s`); }

// hand launch (ESA 4.4) at full throttle, hands off: must climb away and not hit the ground
{ const pl = mk(); pl.pos.set(0, 1.4, -3); pl.held = true; pl.input.throttle = 1; pl.launch(); let minY = 99; run(pl, 6, (p) => { minY = Math.min(minY, p.pos.y); });
  check("hand launch climbs away", minY > 0.5 && pl.pos.y > 4, `min height ${minY.toFixed(1)} m, after 6 s y=${pl.pos.y.toFixed(1)} m, ${pl.vel.length().toFixed(1)} m/s`); }

// landing on the belly: ends on the ground without exploding
{ const pl = fly(mk(), 2, 9, 0); run(pl, 5); check("belly landing settles on the ground", pl.onGround && Number.isFinite(pl.pos.y) && pl.pos.y < 0.2 && pl.vel.length() < 3, `y=${pl.pos.y.toFixed(2)} v=${pl.vel.length().toFixed(1)} onGround=${pl.onGround}`); }

// battery drains with throttle and the motor stops at zero
{ const pl = fly(mk(), 800, 14, 1); let t = 0; while (pl.energyWh > 0 && t < 900) { pl.step(1 / 120); t += 1 / 120; }
  check("battery: 15 Wh lasts minutes at full throttle", t > 200 && t < 600, `${(t / 60).toFixed(1)} min`); }

// stall: slow with full back stick must stay finite
{ const pl = fly(mk(), 60, 8, 0); pl.input.elevator = 1; run(pl, 6); check("stall stays finite", Number.isFinite(pl.pos.y) && Number.isFinite(pl.vel.length()), `y=${pl.pos.y.toFixed(1)} v=${pl.vel.length().toFixed(1)}`); }

// all four planes fly (finite glide), and a bigger span gives more lift area
for (const id of ["spitfire", "hurricane", "fw190", "yak3"]) { const pl = fly(mk({ plane: id }), 200, 11, 0); run(pl, 8); check(`${id} glides`, Number.isFinite(pl.pos.y) && pl.pos.y < 200 && pl.pos.y > 100, `y=${pl.pos.y.toFixed(0)} v=${pl.vel.length().toFixed(1)}`); }
{ const t0 = Date.now(); const pl = fly(mk(), 500, 13, 0.6); run(pl, 20); const ms = Date.now() - t0; check("speed: 20 s of flight computes in well under real time", ms < 6000, `${ms} ms`); }
// editable parameters: overrides change the plane and the weighed mass, garbage is ignored
{ const { defMassKg, defSpanMm } = await import("../shared/picasim/esaDef.js"), { listParams } = await import("../shared/picasim/overrides.js");
  const d0 = buildEsaDef({}), d1 = buildEsaDef({ paramOverrides: { "wings[Left2].CLPerDegree": 0.05, "shapes[Ballast].mass": 0.1, "bogus.path": 5, "settings.dragScale": "x" } });
  check("parameter overrides apply (and garbage is ignored)", d1.wings.find((w) => w.name === "Left2").CLPerDegree === 0.05 && d1.settings.dragScale === 1, `Left2 CLPerDegree ${d0.wings.find((w) => w.name === "Left2").CLPerDegree} -> 0.05`);
  check("an edited ballast shows in the weighed mass", defMassKg(d1) - defMassKg(d0) > 0.07, `${(defMassKg(d0) * 1000).toFixed(0)} -> ${(defMassKg(d1) * 1000).toFixed(0)} g`);
  check("measured span follows the build and the geometry", Math.abs(defSpanMm(d0) - 800) < 3 && Math.abs(defSpanMm(buildEsaDef({ spanMm: 700 })) - 700) < 3, `${defSpanMm(d0).toFixed(0)} mm, 700 build -> ${defSpanMm(buildEsaDef({ spanMm: 700 })).toFixed(0)} mm`);
  check("the editor lists every plane parameter", listParams(d0).length > 100, `${listParams(d0).length} parameters`); }
process.exit(fail ? 1 : 0);
