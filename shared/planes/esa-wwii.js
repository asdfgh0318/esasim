// Generic ESA WWII single-engine foam fighter. Limits from ESA 2024 §3.1.2, §3.4, §3.6.2.
// [kit] = ESA Hurricane kit page at ef3m.pl (papers/poland/shop_ef3m_hurricane.html, local): span 800 mm, length about 600 mm,
// 200-350 g depending on equipment, prop 8x4 or 9x5, motor with at least 300 g thrust.
// [scad] = from models/scad/esa_plane.scad. DESIGN = our estimate to tune (no source gives these).
import { buildEsaDef } from "../picasim/esaDef.js";

export const ESA_WWII = {
  def: buildEsaDef({}),   // PicaSim-derived aeroplane definition (shared/picasim/); the numbers below are kept for the old model, rules and UI
  name: "ESA WWII generic (foam)",
  mass: 0.32,            // kg: rule 0.2-0.45 kg (§3.6.2), kit 0.20-0.35 kg [kit]
  span: 0.80,            // m: rule 0.70-0.86 m (§3.1.2), kit 0.80 m [kit]
  wingArea: 0.10,        // m²  DESIGN (about 12.5 cm mean chord)
  propPitchIn: 5,        // in  [kit] 9x5 (ESA allows any factory prop, §3.5)
  propDiaIn: 9,          // in  [kit]
  maxRpm: 11000,         // rpm DESIGN (3S, about 1200 KV outrunner); pitch speed = 23.3 m/s (no rpm limit in ESA)
  staticThrust: 4.5,     // N   DESIGN: kit says at least 300 g (2.9 N); about 1.4 thrust/weight, 15 Wh battery (§3.4)
  cl0: 0.25, clAlpha: 4.0, alphaStall: 0.26,   // DESIGN: foam, thin flat-ish section
  cd0: 0.042, oswald: 0.75,                      // DESIGN: foam fuselage and exposed parts
  batteryWh: 15,         // ESA §3.4 maximum
  powerW: 120,           // W at full throttle, DESIGN
  // Body geometry along +z from the centre of gravity, metres (the SCAD model's origin).
  noseZ: 0.235,          // prop disc position [scad]
  wingLeZ: 0.055,        // wing root leading edge (ESA §3.1 allows sandpaper cutters on it) [scad]
  tailZ: -0.335,         // streamer attachment, the tail end [scad]
  authority: { pitch: 30, roll: 60, yaw: 16 },
  stability: { pitch: 30, yaw: 25, dihedral: 8 },
  damping: { pitch: 9, roll: 14, yaw: 6 },
};
