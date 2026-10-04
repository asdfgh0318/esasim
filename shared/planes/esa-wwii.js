// Generic ESA WWII single-engine foam fighter. Limits from ESA 2024 §3.1.2, §3.4, §3.6.2.
// DESIGN = our estimate to tune (no source gives these). Replace with real models when Adam sends them.
export const ESA_WWII = {
  name: "ESA WWII generic (foam)",
  mass: 0.40,            // kg: rule 0.2-0.45 kg (§3.6.2)
  span: 0.80,            // m: rule 0.70-0.86 m (§3.1.2)
  wingArea: 0.10,        // m²  DESIGN (about 12.5 cm mean chord)
  propPitchIn: 4.3,      // in  DESIGN (ESA allows any factory prop, §3.5)
  propDiaIn: 5,          // in  DESIGN
  maxRpm: 13000,         // rpm DESIGN; pitch speed = 23.7 m/s (no rpm limit in ESA)
  staticThrust: 6,       // N   DESIGN (about 1.5 thrust/weight, 15 Wh battery §3.4)
  cl0: 0.25, clAlpha: 4.0, alphaStall: 0.26,   // DESIGN: foam, thin flat-ish section
  cd0: 0.05, oswald: 0.75,                      // DESIGN: foam fuselage and exposed parts
  // Body geometry along +z from the centre of gravity, metres. DESIGN (foam fighter, about 0.65 m long).
  noseZ: 0.22,           // prop disc position
  wingLeZ: 0.06,         // wing leading edge (ESA §3.1 allows sandpaper cutters on it)
  tailZ: -0.36,          // streamer attachment
  authority: { pitch: 30, roll: 60, yaw: 16 },
  stability: { pitch: 30, yaw: 25, dihedral: 8 },
  damping: { pitch: 9, roll: 14, yaw: 6 },
};
