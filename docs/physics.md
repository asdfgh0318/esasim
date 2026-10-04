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

## Foamy indoor-aerobat character (2026-10-04, issues #19 and #20)

Adam asked for default planes that fly like a foamy indoor aerobatic plane, 20 % heavier than the first estimates, with proportionally more thrust, and for adjustable servo throws.

- **Mass:** `FOAMY_MASS_PERCENT = 20` (`shared/picasim/esaDef.js`, `settings.extraMassPercent`): the default build weighs 393 g (was about 328 g), still inside ESA §3.6.2 (200-450 g).
- **Thrust:** motor torque x 1.2^1.5 because prop thrust grows about with torque^(2/3); static thrust is now 6.3 N (about 640 g, thrust-to-weight 1.6, 114 W, about 8 min on a 15 Wh pack). DESIGN numbers.
- **Throws:** aileron, elevator and rudder deflection at full stick are build parameters (`aileronDeg`, `elevatorDeg`, `rudderDeg`, 10-45 degrees, default 30 each, was 25/25/20), sliders in the workshop, saved with the build and sent to the server. They are not an ESA rule, so they do not affect legality, and contest rooms (`?strict=1`) allow them (they are not physics overrides). At full stick: roll about 490 deg/s, pitch about 270 deg/s with the default throws; 15 to 45 degrees of aileron changes the roll rate from about 260 to about 650 deg/s (`test/picasim.test.js`).
- **Hand launch:** throw speed 10 m/s (was 9) so the heavier plane does not sag into the ground.
- Not done: a real "foamy" airframe (much lower wing loading, very large control surfaces, 3D-style post-stall); the ESA 200 g minimum rules out an actual indoor foamy of 30-60 g, so the character comes from large authority and a high thrust-to-weight, not from the real mass.

