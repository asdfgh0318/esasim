// NOT ESA-LEGAL (820 g > 450 g, §3.6.2): kept as an ACES-class reference model.
// FW-190D "Dora" 1/12 electric, plan by Leonhard Grugl (models/plans/FockeWulfFW190D.zip, FactsInfoInstructions.pdf p.3).
// [plan] = value stated in the plan. [wing.jpg] = read off the wing drawing: root chord 20.5 cm, tip 11.8 cm, half-span 42.8 cm.
// [rule] = derived from ACES WWII 2023 §3.4 E. DESIGN = our estimate, to tune; not from any source.
export const FW190D = {
  name: "FW-190D Dora",
  mass: 0.82,            // kg [plan: ca. 820 g] (class .15 min 700 g, max 1500 g, §3.4 E)
  span: 0.875,           // m   [plan]
  wingArea: 0.14,        // m²  [wing.jpg: 2 * 0.428 * (0.205 + 0.118) / 2 = 0.138, rounded]
  propPitchIn: 4.7,      // in  [plan: 9x4.7]
  propDiaIn: 9,          // in  [plan] (max 9 in for .10/.15, §3.4 E)
  maxRpm: 72000 / 4.7,   // rpm [rule: PSS = rpm * pitch <= 72 000]
  staticThrust: 8,       // N   DESIGN (plan: 25 A outrunner on 3S, no thrust figure given)
  cl0: 0.2, clAlpha: 4.2, alphaStall: 0.26,   // DESIGN: cambered NACA 2412/2415 [plan], AR ~5.5
  cd0: 0.04, oswald: 0.8,                      // DESIGN
  // Control and stability, rad/s² at the reference dynamic pressure (15 m/s). DESIGN, tuned in test/flight.test.js.
  authority: { pitch: 30, roll: 40, yaw: 16 },
  stability: { pitch: 30, yaw: 25, dihedral: 8 },
  damping: { pitch: 9, roll: 14, yaw: 6 },
};
