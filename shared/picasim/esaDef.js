// ESA foam fighter definitions for the PicaSim-derived physics (shared/picasim/). Geometry from models/scad/esa_plane.scad
// (X forward, Y left, Z up here, origin near the centre of gravity), aerofoil and control numbers in the style of PicaSim's own
// aeroplanes (Spitfire, Extra3D). The aero and mass numbers are estimates to be tuned in test/picasim.test.js.
// Derived in part from PicaSim by Danny Chapman, PolyForm Noncommercial 1.0.0 (see NOTICE).
const AEROFOILS = {
  // thin cambered EPP wing; foam is rough, so a higher flying drag than a smooth section
  Wing: { CDFlying: 0.014, CDStalled: 1.7, CM0: -0.04, CMPerDeg: 0.002, CL0: 0.2, CLPerDeg: 0.085, positiveAttachedAngle: 9, positiveStallRange: 11,
    negativeAttachedAngle: -7, negativeStallRange: -9, dragBucketFactor: 0.1, dragBucketLowerAngle: -2, dragBucketUpperAngle: 6 },
  Flat: { CDFlying: 0.02, CDStalled: 1.7, CM0: 0, CMPerDeg: 0, CL0: 0, CLPerDeg: 0.1, positiveAttachedAngle: 7.5, positiveStallRange: 11.5,
    negativeAttachedAngle: -7.5, negativeStallRange: -11.5, dragBucketFactor: 0, dragBucketLowerAngle: -5, dragBucketUpperAngle: 5 },
};

// Planform per plane [scad]: mean chord of the inner (root to 0.2 m) and outer panel, trailing edge x.
const PLANFORM = {
  spitfire: { ci: 0.147, co: 0.117, te: -0.100 }, hurricane: { ci: 0.1425, co: 0.1075, te: -0.100 },
  fw190: { ci: 0.1345, co: 0.1035, te: -0.095 }, yak3: { ci: 0.1285, co: 0.0955, te: -0.100 },
};
const DIHEDRAL_DEG = Math.atan(0.06 / 0.40) * 180 / Math.PI;      // 60 mm at the tip over a 0.4 m half span (ESA kit guide)

import { applyOverrides } from "./overrides.js";

// Foamy indoor-aerobat character (Adam, issue #19): 20 % more mass than the first estimates and the motor torque (so thrust) scaled by the same
// factor, thrust-to-weight stays high; control surfaces are generous and their throws are adjustable per plane (issue #20, degrees of deflection at full stick).
// (prop thrust grows about with torque^(2/3), so +20 % thrust needs 1.2^1.5 times the torque.)
export const FOAMY_MASS_PERCENT = 20, FOAMY_THRUST_FACTOR = 1.2;
export const DEFAULT_THROWS = { aileronDeg: 30, elevatorDeg: 30, rudderDeg: 30 };
export const DEFAULT_BUILD = { plane: "spitfire", spanMm: 800, batteryWh: 15, propDiaIn: 9, propPitchIn: 5, ballastG: 20, ...DEFAULT_THROWS };

// build: { plane, spanMm, batteryWh, propDiaIn, propPitchIn, ballastG }. Returns an unresolved definition (see aeroplane.js resolveDef).
export function buildEsaDef(b0 = {}) {
  const b = { ...DEFAULT_BUILD, ...b0 }, pf = PLANFORM[b.plane] || PLANFORM.spitfire;
  const k = b.spanMm / 800, half = 0.40 * k, y1 = 0.02, y2 = 0.02 + (half - 0.02) * 0.5;       // wing panels: root to y2 (inner), y2 to the tip
  const cosD = Math.cos(DIHEDRAL_DEG * Math.PI / 180), innerLen = (y2 - y1) / cosD, outerLen = (half - y2) / cosD,   // panel lengths along the dihedral, so the projected span is exact
     meanChord = 0.5 * (pf.ci + pf.co), AR = (2 * half) / meanChord;
  const r = b.propDiaIn * 0.0254 / 2, pitch = b.propPitchIn * 0.0254;
  const wing = (name, chord, y, len, z, extra = {}) => ({
    name, aerofoil: "Wing", numSections: 2, mass: 0.019 * k, position: [pf.te + chord / 2, y, z], roll: DIHEDRAL_DEG,
    extents: [chord, len, 0.008], wingAspectRatio: AR, wingSpanEfficiency: 0.85, groundEffect: true, ...extra,
  });
  const zOuter = -0.010 + (y2 - y1) * Math.tan(DIHEDRAL_DEG * Math.PI / 180);   // the outer panel starts where the inner one ends
  const aileron = { CLPerDegree: 0.02, CDPerDegree: 0.06, CMPerDegree: -0.01, flapFraction: 0.3, degreesPerControl: b.aileronDeg, controlRate: 12, controlPerChannel: { 0: 1 }, mass: 0.016 * k };
  return applyOverrides({
    name: `ESA ${b.plane}`,
    settings: { sizeScale: 1, massScale: 1, dragScale: 1, engineScale: 1, extraMassPercent: FOAMY_MASS_PERCENT },
    dynamics: { wingSpan: 2 * half, wingChord: meanChord, CMRollFromY: 0.004 },
    aerofoils: AEROFOILS,
    wings: [
      wing("Left1", pf.ci, y1, innerLen, -0.010, { mass: 0.022 * k }),
      wing("Left2", pf.co, y2, outerLen, zOuter, aileron),
      { name: "Right1", copy: "Left1", mirror: true }, { name: "Right2", copy: "Left2", mirror: true },
      { name: "Tail", aerofoil: "Flat", numSections: 2, mass: 0.008, position: [-0.2925, -0.14, 0.008], rotation: [0, 2.5, 0], extents: [0.085, 0.28, 0.006],   // 2.5 degrees of tail incidence: steady full-throttle hand launch
         wingAspectRatio: 3.3,
        wingSpanEfficiency: 0.8, groundEffect: true, washFromWing: [{ name: "Left1", fraction: 0.3 }, { name: "Right1", fraction: 0.3 }], washFromEngine: { name: "Engine", fraction: 0.1 },
        CLPerDegree: 0.02, CDPerDegree: 0.05, CMPerDegree: -0.01, flapFraction: 0.4, degreesPerControl: b.elevatorDeg, controlRate: 12, controlPerChannel: { 1: 1 } },
      { name: "Fin", aerofoil: "Flat", numSections: 2, mass: 0.003, position: [-0.29, 0, 0.010], roll: 90, extents: [0.09, 0.10, 0.006], wingAspectRatio: 1.1,
        wingSpanEfficiency: 0.8, washFromEngine: { name: "Engine", fraction: 0.15 }, CLPerDegree: 0.015, CDPerDegree: 0.05, CMPerDegree: -0.01, flapFraction: 0.4,
        degreesPerControl: b.rudderDeg, controlRate: 12, controlPerChannel: { 2: -1 } },
      // side area of the fuselage: a very low aspect ratio "wing" standing on edge (as in PicaSim's Spitfire/Extra3D)
      { name: "FuselageVertical", aerofoil: "Flat", numSections: 1, numPieces: 2, mass: 0, position: [-0.03, 0, -0.025], roll: 90, extents: [0.55, 0.055, 0.01], wingAspectRatio: 0.1 },
    ],
    fuselages: [{ name: "Fuselage", mass: 0.035, position: [-0.03, 0, 0], extents: [0.55, 0.05, 0.06], CD: [0.4, 1, 1] }],
    engines: [{
      name: "Engine", position: [0.235, 0, 0], numBlades: 2, radius: r, pitch, bladeChord: 0.07 * r, CL0: 0.3, CLPerDegree: 0.1, CD0: 0.12, CDInducedMultiplier: 1,
      stallAngle: 14, inertia: 4e-5 * (r / 0.1143) ** 4, maxTorque: 0.06 * FOAMY_THRUST_FACTOR ** 1.5, maxRPM: 12000, minRPM: 0, frictionTorque: 0.001, aeroTorqueScale: 0.3, washRotationFraction: 0.02,
      propDiskAreaScale: 0.35, controlExp: 1, controlRate: 6, controlPerChannel: { 3: 1 },
    }],
    shapes: [
      { name: "Motor", mass: 0.050, position: [0.215, 0, 0], extents: [0.04, 0.03, 0.03] },
      { name: "Battery", mass: 0.0067 * b.batteryWh, position: [0.0, 0, -0.005], extents: [0.09, 0.03, 0.025] },
      { name: "Electronics", mass: 0.035, position: [-0.09, 0, 0], extents: [0.1, 0.03, 0.03] },
      { name: "Ballast", mass: b.ballastG / 1000, position: [0.20, 0, 0], extents: [0.03, 0.03, 0.03] },
    ],
    groundPoints: [
      { name: "Nose", position: [0.20, 0, -0.03] }, { name: "Belly", position: [0.0, 0, -0.03] }, { name: "Tail", position: [-0.30, 0, -0.012] },
      { name: "TipL", position: [-0.05, half, -0.010 + 0.06 * k] }, { name: "TipR", position: [-0.05, -half, -0.010 + 0.06 * k] }, { name: "FinTop", position: [-0.30, 0, 0.11] },
    ],
  }, b.paramOverrides);
}

// Total mass in kg of a definition (what the judge weighs, ESA 3.6.2): wings, fuselages and shapes, before the PicaSim size/mass scaling.
export function defMassKg(def) {
  const s = { sizeScale: 1, massScale: 1, ...(def.settings || {}) }, k = s.massScale * s.sizeScale ** 3;
  const wings = def.wings.reduce((a, w) => a + (w.mass ?? (def.wings.find((x) => x.name === w.copy)?.mass ?? 0)), 0);
  return k * (wings + (def.fuselages || []).reduce((a, f) => a + (f.mass || 0), 0) + (def.shapes || []).reduce((a, f) => a + (f.mass || 0), 0))
    * (1 + 0.01 * (def.settings?.extraMassPercent || 0));
}

// Wingspan in mm measured from the definition's geometry (what the judge measures, ESA 3.1.2): the widest wing tip, doubled.
export function defSpanMm(def) {
  let y = 0;
  for (const w of def.wings) {
    const base = w.copy ? def.wings.find((x) => x.name === w.copy) : w;
    if (!base || !base.extents || base.name === "FuselageVertical" || Math.abs(base.roll || 0) > 60) continue;
    const s = def.settings?.sizeScale ?? 1, r = (base.roll || 0) * Math.PI / 180;
    y = Math.max(y, (Math.abs(base.position[1] + base.extents[1] * Math.cos(r) * Math.cos((base.yaw || 0) * Math.PI / 180))) * s);   // a swept panel (yaw) projects shorter
  }
  return 2 * y * 1000;
}
