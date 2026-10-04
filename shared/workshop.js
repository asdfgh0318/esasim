// Workshop: a pilot's build (plane type, span, battery, prop, ballast) -> flight parameters and an ESA legality check.
// Limits: ESA 2024 §3.1.2 (span 700-860 mm), §3.4 (battery max 15 Wh), §3.6.2 (mass 200-450 g). Breaking the mass or battery
// limit scores 0 points for the round (§6). Mass model and prop scaling are DESIGN (listed in docs/models.md).
import { planeParams } from "./planes/index.js";
import { PLANE_LIMITS } from "./rules.js";

export const DEFAULT_BUILD = { plane: "spitfire", spanMm: 800, batteryWh: 15, propDiaIn: 9, propPitchIn: 5, ballastG: 20 };
export const RANGES = { spanMm: [650, 900, 10], batteryWh: [5, 20, 0.5], propDiaIn: [6, 11, 0.5], propPitchIn: [3, 7, 0.5], ballastG: [0, 250, 5] };
const POWER_W = 120;            // DESIGN: motor power at full throttle (the kit motor "min 300 g thrust")

export function clampBuild(b = {}) {
  const out = { plane: b.plane || DEFAULT_BUILD.plane };
  for (const [k, [lo, hi]] of Object.entries(RANGES)) { const v = Number(b[k]); out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : DEFAULT_BUILD[k]; }
  return out;
}
// DESIGN mass model: foam airframe with motor, ESC, servos and receiver; battery about 6.7 g/Wh; prop about 1 g per inch.
export const massKg = (b) => 0.085 + 0.10 * (b.spanMm / 800) ** 2 + 0.0067 * b.batteryWh + 0.0009 * b.propDiaIn + b.ballastG / 1000;

export function validate(build) {
  const b = clampBuild(build), problems = [], mass = massKg(b) * 1000;
  const [sLo, sHi] = PLANE_LIMITS.spanMm, [mLo, mHi] = PLANE_LIMITS.massG;
  if (b.spanMm < sLo || b.spanMm > sHi) problems.push({ rule: "§3.1.2", text: `Span ${b.spanMm} mm is outside ${sLo}-${sHi} mm` });
  if (mass < mLo) problems.push({ rule: "§3.6.2", text: `Mass ${mass.toFixed(0)} g is below the ${mLo} g minimum: add ballast` });
  if (mass > mHi) problems.push({ rule: "§3.6.2", text: `Mass ${mass.toFixed(0)} g is above ${mHi} g: 0 points for the round (§6)` });
  if (b.batteryWh > PLANE_LIMITS.batteryWh) problems.push({ rule: "§3.4", text: `Battery ${b.batteryWh} Wh is above ${PLANE_LIMITS.batteryWh} Wh: 0 points for the round (§6)` });
  return { ok: problems.length === 0, problems, massG: mass, build: b };
}

// Flight parameters for a build. Prop scaling at constant motor power (momentum theory, DESIGN): thrust ~ D^(2/3), rpm ~ D^(-5/3) * pitch^(-1/3).
export function toParams(build) {
  const b = clampBuild(build), base = planeParams(b.plane);
  const d = b.propDiaIn / 9, p = b.propPitchIn / 5;
  return {
    ...base, build: b,
    mass: massKg(b), span: b.spanMm / 1000, wingArea: base.wingArea * (b.spanMm / 800),
    propDiaIn: b.propDiaIn, propPitchIn: b.propPitchIn,
    maxRpm: 11000 * d ** (-5 / 3) * p ** (-1 / 3),
    staticThrust: 4.5 * d ** (2 / 3) * p ** (-1 / 3),
    batteryWh: b.batteryWh, powerW: POWER_W,
  };
}
