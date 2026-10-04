# Flight physics

ESASIM flies on a JavaScript port of the **PicaSim** physics (Danny Chapman, PolyForm Noncommercial 1.0.0, see `NOTICE`). The port is in `shared/picasim/`; the rendering, UI, multiplayer and rules are ESASIM's own. Only PicaSim's code and parameter data are used. **Its images and models are not**: its README says they need the authors' permission for use in other projects.

## What is ported

| File | From PicaSim | What it does |
|---|---|---|
| `aerofoil.js` | `AerofoilDefinition.cpp`, `Aerofoil.cpp` | CL/CD/CM curves with stall, drag bucket, Reynolds-number drag scaling, aspect-ratio corrections, flat-plate post-stall branch; the per-element force: prop wash, wing wash, ground effect, shadowing, downwash |
| `components.js` | `Wing.cpp`, `Fuselage.cpp`, `PropellerEngine.cpp` | control surfaces (flap angle, camber, servo rate), box drag, a blade-element propeller with RPM dynamics, momentum-theory wash, roll/pitch damping and gyroscopic momentum |
| `aeroplane.js` | `AeroplanePhysics.cpp` | mass, centre of gravity and inertia from the component boxes; force and torque accumulation; the PicaSim size/mass/drag/engine scaling (`resolveDef`). **Replaced:** Bullet's rigid body (a small 6-DOF integrator) and the wheels (penalty ground contacts: the ESA planes are belly-landers) |
| `plane.js` | none | adapter to the interface the rest of the game uses (`step`, `launch`, `pos`, `quat`, `input`, battery) and the frame conversion |
| `overrides.js` | none | the editable-parameter system |
| `esaDef.js` | the XML aeroplane definitions, as a format | the four ESA plane definitions, generated from a workshop build |

Frames: inside `shared/picasim/` X is forward, Y left, Z up (PicaSim). ESASIM's world is three.js (y up, z forward, so **+x is the plane's left**). `plane.js` converts with `v_ours = (Y, Z, X)`.

## The ESA planes

`buildEsaDef(build)` makes a definition: two wing panels per side (the outer one carries the aileron), a flat tail plate with an elevator, a fin, a side-area "wing" for the fuselage, a box-drag fuselage, a two-blade electric propeller, and mass shapes for the motor, battery (6.7 g per Wh), electronics and ballast. Geometry is from `models/scad/esa_plane.scad` and the ESA kit data (800 mm span, about 600 mm long, 200-350 g, 9x5 prop, 60 mm dihedral). **Every aerodynamic and mass number beyond that is an estimate**, tuned for these behaviours (see `test/picasim.test.js`): a stable full-throttle hand launch, a damped phugoid, about 5 N static thrust for about 130 W, roll about 400 deg/s and pitch about 220 deg/s at cruise, a glide ratio near 3 with the windmilling prop, and a 15 Wh battery lasting about 9 minutes at full throttle.

Known trade-offs: with this layout a hands-off launch needs full throttle (a real pilot's habit; the keyboard launch sets it), and the glide ratio is modest because a windmilling prop is a lot of drag on a 320 g plane.

## Changing parameters

Two layers, both in the UI:

1. **Workshop** (button in the waiting room): plane type, span, battery, prop, ballast, video transmitter. Checked against ESA §3.1.2, §3.4, §3.6.2.
2. **Advanced physics** (button inside the workshop): about 175 numbers of the definition (PicaSim-style: wing CLPerDegree, flapFraction, degreesPerControl, aerofoil CL0 and stall angles, propeller radius, pitch, torque, inertia, masses, positions, the aeroplane size/mass/drag/engine scales ...), searchable, with import and export as JSON. Edits are saved in the build as `paramOverrides` and applied on the client and the server, so the weighed mass and the measured span still count: an illegal plane flies but scores 0 for the round (§6).

## Tests

`npm test` includes `test/picasim.test.js` (aerofoil curves and stall, mass and CG, motor, glide, control directions, rates, hand launch, belly landing, battery, stall, all four planes, speed, parameter overrides) and the headless bot fight. The old lumped model in `shared/flight.js` is kept as a fallback and has its own tests (`test/flight.test.js`).
