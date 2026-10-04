// PicaSim "Electric Kato": a swept flying wing with elevons and a pusher propeller (design by Kevin Bagwell, RCGroups thread 1988349, as
// listed in PicaSim's data/SystemSettings/Aeroplane/ElectricKato.xml). The numbers below are transcribed from PicaSim's data files
// SystemData/Aeroplanes/ElectricKato/Aeroplane.xml, Kato-foil-root.xml and Kato-foil-tip.xml (XML data, usable under PolyForm
// Noncommercial with the notice in NOTICE; PicaSim's 3D model and textures are NOT used, the mesh is our own: models/scad/kato.scad).
// Axes as in PicaSim: X forward, Y left, Z up. The native span is 1.21 m; the workshop span scales the whole plane (PicaSim sizeScale).
import { applyOverrides } from "./overrides.js";

export const KATO_SPAN_MM = 1210;
export const KATO_ELEVATOR_MIX = 0.5;                 // PicaSim: 0.25. The elevons mix more elevator here so a hand-launched plane can recover (pitch rate about 165 deg/s instead of 65)
export const KATO_TORQUE = 2;                         // multiplier on PicaSim's maxTorque: thrust-to-weight about 1 at 860 mm (PicaSim's own value gives 0.5), cruise about 16-20 m/s at 60 % throttle
export const KATO_PROP = { radius: 0.0762, pitch: 0.17, chord: 0.013 };   // an absolute 6 in prop in metres at any plane size (PicaSim scales the prop with the plane, which leaves a small Kato with almost no thrust)
// Kato is not an ESA WWII warbird: at its native size it is far outside ESA 3.1.2 (700-860 mm), so the workshop marks it illegal until it
// is scaled down (span 700-860 mm) and ballasted to the 200 g minimum (3.6.2). It stays a flyable practice plane in the meantime.
export const KATO_DEFAULTS = { aileronDeg: 30, elevatorDeg: 30 };

// Hands-off the Kato dives: its sections are symmetric (CL0 = 0, CM0 = 0), so it trims at zero lift, as it does in PicaSim, where the pilot holds
// up-elevator. It is a stick-flown plane. Sweeps (see the git history of this file) showed a built-in up-trim glides better (6.5:1 at 0.15
// native) but pitches the nose down after a throw, so no trim is baked in; `b.trim` can still be set (control units, both panels).

const AEROFOILS = {
  "Kato-root": { CDFlying: 0.01, CDStalled: 1.0, CM0: 0, CMPerDeg: -0.006, refRe: 200000, CDPower: -0.15, minReFrac: 0.1, CL0: 0, CLPerDeg: 0.08,
    positiveAttachedAngle: 10, positiveStallRange: 9, negativeAttachedAngle: -10, negativeStallRange: -9, dragBucketFactor: 0.3, dragBucketLowerAngle: -3, dragBucketUpperAngle: 3 },
  "Kato-tip": { CDFlying: 0.01, CDStalled: 1.0, CM0: 0, CMPerDeg: -0.006, refRe: 200000, CDPower: -0.15, minReFrac: 0.1, CL0: 0, CLPerDeg: 0.08,
    positiveAttachedAngle: 10, positiveStallRange: 10, negativeAttachedAngle: -10, negativeStallRange: -10, dragBucketFactor: 0.3, dragBucketLowerAngle: -3, dragBucketUpperAngle: 3 },
  NACA0009: { CDFlying: 0.006, CDStalled: 1.7, CM0: 0, CMPerDeg: 0, refRe: 200000, CDPower: -0.15, minReFrac: 0.1, CL0: 0, CLPerDeg: 0.11,
    positiveAttachedAngle: 8.5, positiveStallRange: 11.5, negativeAttachedAngle: -8.5, negativeStallRange: -11.5, dragBucketFactor: 0.2, dragBucketLowerAngle: -5, dragBucketUpperAngle: 5 },
};

// build: { spanMm, batteryWh, ballastG, aileronDeg, elevatorDeg, paramOverrides }. The elevons mix aileron (channel 0, 35 degrees per unit in PicaSim)
// and elevator (channel 1, 0.25 of that); the throw sliders scale those two relative to the PicaSim defaults (30 and 30 give exactly PicaSim's values).
export function buildKatoDef(b0 = {}) {
  const b = { spanMm: KATO_SPAN_MM, batteryWh: 15, ballastG: 0, ...KATO_DEFAULTS, ...b0 };
  const sc = b.spanMm / KATO_SPAN_MM;
  const ail = 35 * b.aileronDeg / KATO_DEFAULTS.aileronDeg, elev = (b.elevMix ?? KATO_ELEVATOR_MIX) * b.elevatorDeg / KATO_DEFAULTS.elevatorDeg;
  const elevon = { trimControl: b.trim ?? 0, CLPerDegree: 0.003, CDPerDegree: 0, CMPerDegree: -0.002, flapFraction: 0.2, degreesPerControl: ail, controlRate: 10, controlClamp: 1, controlPerChannel: { 0: 1, 1: elev } };
  return applyOverrides({
    name: "Electric Kato (PicaSim)",
    settings: { sizeScale: b.spanMm / KATO_SPAN_MM, massScale: 1, dragScale: 1, engineScale: 1, extraMassPercent: 0 },
    dynamics: { wingSpan: 1.21, wingChord: 0.39, CMRollFromY: 0 },
    aerofoils: AEROFOILS,
    wings: [
      { name: "Left1", aerofoil: "Kato-root", numSections: 2, mass: 0.08, position: [0.01, 0.025, 0], yaw: 24, extents: [0.29, 0.3, 0.01], wingAspectRatio: 5, groundEffect: true, ...elevon },
      { name: "Left2", aerofoil: "Kato-tip", numSections: 5, mass: 0.03, position: [-0.08, 0.3, 0], yaw: 24, extents: [0.22, 0.33, 0.01], wingAspectRatio: 5, groundEffect: true, ...elevon, CLPerDegree: 0.006 },
      { name: "Right1", copy: "Left1", mirror: true }, { name: "Right2", copy: "Left2", mirror: true },
      { name: "FinLeft", aerofoil: "NACA0009", numSections: 2, mass: 0.001, position: [-0.3, 0.605, -0.04], roll: 90, extents: [0.1, 0.1, 0.01], wingAspectRatio: 5 },
      { name: "FinRight", copy: "FinLeft", mirror: true },
    ],
    fuselages: [{ name: "Fuselage", mass: 0.0000001, position: [0, 0, 0], extents: [0.4, 0.06, 0.06], CD: [1.0, 0.5, 0.5] }],
    engines: [{
      name: "Engine", position: [-0.124947, 0, 0], numBlades: 2, radius: KATO_PROP.radius / sc, pitch: KATO_PROP.pitch / sc, bladeChord: KATO_PROP.chord / sc, CL0: 0.5, CLPerDegree: 0.1, CD0: 0.02, CDInducedMultiplier: 1,
      stallAngle: 15, inertia: 0.000013, maxTorque: 0.06 * (b.torqueScale ?? KATO_TORQUE), maxRPM: 15000, minRPM: 0, frictionTorque: 0.02, washRotationFraction: 0, propDiskAreaScale: 0.35,
      controlExp: 0.5, controlRate: 6, controlPerChannel: { 3: 1 },
    }],
    // The scaling of the plane (PicaSim sizeScale) multiplies every mass by scale^3, but a battery, the electronics and ballast do not shrink with the
    // airframe, so their masses are given in real kilograms (divided by scale^3 here).
    shapes: [   // PicaSim's two 100 g boxes: battery up front (100 g is 15 Wh at 6.7 g/Wh) and the electronics at the back
      { name: "Battery", mass: 0.0067 * b.batteryWh / sc ** 3, position: [0.13, 0, 0], extents: [0.025, 0.025, 0.025] },
      { name: "Electronics", mass: 0.1 / sc ** 3, position: [-0.16, 0, 0], extents: [0.025, 0.025, 0.025] },
      { name: "Ballast", mass: b.ballastG / 1000 / sc ** 3, position: [b.ballastX ?? 0.13, 0, 0], extents: [0.025, 0.025, 0.025] },
    ],
    groundPoints: [
      { name: "Nose", position: [0.2, 0, -0.01] }, { name: "TipL", position: [-0.2, 0.6, -0.02] }, { name: "TipR", position: [-0.2, -0.6, -0.02] }, { name: "Tail", position: [-0.28, 0, -0.01] },
    ],
  }, b.paramOverrides);
}
