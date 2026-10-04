// Workshop: a pilot's build (plane type, span, battery, prop, ballast) -> flight parameters and an ESA legality check.
// Limits: ESA 2024 §3.1.2 (span 700-860 mm), §3.4 (battery max 15 Wh), §3.6.2 (mass 200-450 g). Breaking the mass or battery
// limit scores 0 points for the round (§6). Mass model and prop scaling are DESIGN (listed in docs/models.md).
import { planeParams } from "./planes/index.js";
import { PLANE_LIMITS } from "./rules.js";
import { VTX_POWERS } from "./vtx.js";
import { defMassKg, defSpanMm } from "./picasim/esaDef.js";
import { buildPlaneDef } from "./picasim/planeDef.js";
import { isOverridePath } from "./picasim/overrides.js";

export const DEFAULT_BUILD = { plane: "spitfire", spanMm: 800, batteryWh: 15, propDiaIn: 9, propPitchIn: 5, ballastG: 20, aileronDeg: 30, elevatorDeg: 30, rudderDeg: 30, vtxMw: 25, vtxCh: -1 };   // vtxCh -1 = auto (the arena picks a free channel)
export const RANGES = { spanMm: [650, 900, 10], batteryWh: [5, 20, 0.5], propDiaIn: [6, 11, 0.5], propPitchIn: [3, 7, 0.5], ballastG: [0, 250, 5], aileronDeg: [10, 45, 1], elevatorDeg: [10, 45, 1], rudderDeg: [10, 45, 1] };
const POWER_W = 120;            // DESIGN: motor power at full throttle (the kit motor "min 300 g thrust")

export function clampBuild(b = {}) {
  const out = { plane: b.plane || DEFAULT_BUILD.plane };
  for (const [k, [lo, hi]] of Object.entries(RANGES)) { const v = Number(b[k]); out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : DEFAULT_BUILD[k]; }
  if (b.paramOverrides && typeof b.paramOverrides === "object") { out.paramOverrides = {}; for (const [k, v] of Object.entries(b.paramOverrides)) if (isOverridePath(k) && Number.isFinite(Number(v))) out.paramOverrides[k] = Number(v); }   // advanced physics edits
  const mw = Number(b.vtxMw); out.vtxMw = VTX_POWERS.includes(mw) ? mw : DEFAULT_BUILD.vtxMw;     // video transmitter: sim effect, not an ESA rule
  const ch = Math.round(Number(b.vtxCh)); out.vtxCh = Number.isFinite(ch) ? Math.min(7, Math.max(-1, ch)) : -1;
  return out;
}
// Mass is what the aeroplane definition adds up to (wings, fuselage, motor, battery at 6.7 g/Wh, electronics, ballast): shared/picasim/esaDef.js.
export const massKg = (b) => defMassKg(buildPlaneDef(clampBuild(b)));

export function validate(build) {
  const b = clampBuild(build), problems = [], mass = massKg(b) * 1000, spanMm = Math.round(defSpanMm(buildPlaneDef(b)));
  const [sLo, sHi] = PLANE_LIMITS.spanMm, [mLo, mHi] = PLANE_LIMITS.massG;
  if (spanMm < sLo - 1 || spanMm > sHi + 1) problems.push({ rule: "§3.1.2", text: `Span ${spanMm} mm is outside ${sLo}-${sHi} mm` });
  if (mass < mLo) problems.push({ rule: "§3.6.2", text: `Mass ${mass.toFixed(0)} g is below the ${mLo} g minimum: add ballast` });
  if (mass > mHi) problems.push({ rule: "§3.6.2", text: `Mass ${mass.toFixed(0)} g is above ${mHi} g: 0 points for the round (§6)` });
  if (b.batteryWh > PLANE_LIMITS.batteryWh) problems.push({ rule: "§3.4", text: `Battery ${b.batteryWh} Wh is above ${PLANE_LIMITS.batteryWh} Wh: 0 points for the round (§6)` });
  return { ok: problems.length === 0, problems, massG: mass, build: b };
}

// Flight parameters for a build: the old fields (rules, UI, bots) plus the PicaSim-derived aeroplane definition.
export function toParams(build) {
  const b = clampBuild(build), base = planeParams(b.plane), def = buildPlaneDef(b), gs = b.plane === "kato" ? b.spanMm / 800 : 1;   // the Kato's geometry scales with its span (stored for 800 mm)
  return {
    ...base, build: b, def,
    mass: defMassKg(def), span: b.spanMm / 1000, wingArea: base.wingArea * (b.spanMm / 800) ** (b.plane === "kato" ? 2 : 1),
    noseZ: base.noseZ * gs, wingLeZ: base.wingLeZ * gs, tailZ: base.tailZ * gs,
    propDiaIn: b.plane === "kato" ? base.propDiaIn * gs : b.propDiaIn, propPitchIn: b.plane === "kato" ? base.propPitchIn * gs : b.propPitchIn, batteryWh: b.batteryWh, powerW: 120,
  };
}
