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

## Electric Kato (PicaSim flying wing, 2026-10-04, issue #21)

`shared/picasim/katoDef.js` transcribes PicaSim's `ElectricKato` (Aeroplane.xml and the two aerofoil files; design by Kevin Bagwell): two swept panels per side with elevons (aileron on channel 0, elevator mix on channel 1), tip fins, a pusher prop, native span 1.21 m and 423 g (checked in `test/picasim.test.js`). ESASIM adds, all marked in the file:
- the plane scales with the workshop span (PicaSim `sizeScale = span / 1210`); the battery, electronics and ballast are given in real grams so they do not shrink with the airframe (default 800 mm build: 265 g plus ballast, legal under ESA 200-450 g and the 650-900 mm slider range);
- the control response was reworked after two reports from Adam. (1) "response to elevator is bad, cannot turn even though the throw is ramped up" (2026-10-05): with PicaSim's numbers a full pull pitched the plane at only about 80 deg/s (our ESA planes: 270) and a banked turn with a 0.7 pull turned at 22 deg/s while losing 71 m, because its sections are symmetric (CL0 = 0, CM0 = 0) and its elevon lift coefficients (0.003 and 0.006 per degree) are tiny. Fix: elevon lift and moment x2, elevator mix 0.8 (PicaSim 0.25), aileron throw 23 degrees at the default slider (PicaSim 35), motor torque x2, an absolute 6 in prop. (2) "it pitches up constantly, the launch was good always": a first fix with a strongly cambered, reflexed section (CL0 0.3, CM0 0.01) trimmed nose-high and climbed and stalled by itself. A sweep showed a cliff: below CL0 0.14 the plane sinks into the ground within about a second hands-off, above it zooms up to 30+ m/s and stalls, and nothing in the sweep flew stably hands-off under power. So the final Kato has only a mild camber (CL0 0.1, CM0 0): stick centred it sinks gently (pitch about -15 degrees, no climb), a little back stick holds height, and nothing pitches up by itself. Result at 800 mm: pitch about 290 deg/s, roll about 520 deg/s, a banked turn with a 0.5 pull about 70-100 deg/s (`test/picasim.test.js`). The elevator and aileron throw sliders scale around those defaults.
- the plane scales with the workshop span (PicaSim `sizeScale = span / 1210`); the battery, electronics and ballast are given in real grams so they do not shrink with the airframe (default 800 mm build: 265 g plus ballast, legal under ESA 200-450 g and the 650-900 mm slider range);
- the control response was reworked after Adam's report ("response to elevator is bad, cannot turn even though the throw is ramped up", 2026-10-05). Measured with PicaSim's numbers: the elevator pitched the plane at only about 80 deg/s at the start of a full pull (our ESA planes: 270), roll was about 660 deg/s, and a banked turn with a 0.7 pull turned at 22 deg/s while losing 71 m, because PicaSim's sections are symmetric (CL0 = 0, CM0 = 0) so the plane trims at zero lift, and its elevon lift coefficients (0.003 and 0.006 per degree) are tiny. ESASIM therefore uses a cambered/reflexed section (CL0 0.3, CM0 0.01, as real flying wings do), elevon lift and moment x2, elevator mix 0.8 (PicaSim 0.25), aileron throw 23 degrees at the default slider (PicaSim 35), motor torque x2 and an absolute 6 in prop. Result at 800 mm: pitch about 320 deg/s, roll about 410 deg/s, banked turn about 140 deg/s, stable hands-off glide about 10 m/s at 5.7:1 (`test/picasim.test.js`). The elevator and aileron throw sliders scale around those defaults.
- the plane scales with the workshop span (PicaSim `sizeScale = span / 1210`); the battery, electronics and ballast are given in real grams so they do not shrink with the airframe (default 800 mm build: 265 g plus ballast, legal under ESA 200-450 g and the 650-900 mm slider range).
**Not solved:** there is no stable hands-off powered flight (also not with more nose weight or reflex); with stick input the launch, climb and cruise work (cruise about 20-25 m/s at 60 % throttle). The Kato is flown with the sticks. **Bots** fly the Kato with their own profile (`KATO_TUNE` in `shared/bot.js`): cruise throttle 0.4 instead of 0.85 because at the usual cruise speed its turn diameter is longer than the 44 m deep flight zone, speed thresholds 11 and 9 m/s, a +0.2 elevator bias because it sinks with the stick centred, boundary lookahead 1.5 s. Found by sweeps: three Kato bots fly a 5-minute fight with 0 crashes and 0 line slips, 9 cuts and full flight points; mixed fights with ESA planes also work (`test/bot.test.js`). The mesh is original (`models/scad/kato.scad`, `tools/build-models.sh`).

