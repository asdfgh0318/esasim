# Audit: what ESASIM can take from the drone sim

Source: `../symulator_fpv` (github.com/asdfgh0318/fpv_simulator), about 16 000 lines of JS.
Method: listed every module, read the headers and the class/method outline of each candidate, and read the full code of `physics.js`, `GamepadController.js`, `InputManager.js` (input part), the calibration code in `main.js`, `GateDetector.js` and `flightRecorder.js`. I did **not** read all of `main.js` (3 728 lines), `rates.js`, `aiTrainer.js`, `trackEvolver.js` or the vision AI in full; verdicts on those come from headers and outlines.

The new objective is different: not "fastest lap through gates" but "dogfight 2-7 planes, cut streamers, obey ACES scoring". So the verdict is about the *pattern* as much as the code.

## Verdicts

| Module (lines) | What it is | Verdict for ESASIM |
|---|---|---|
| `src/systems/input/*` + calibration in `main.js` (~800) | Gamepad polling, axis mapping, invert, calibration, save/load, panel | **Ported** to `client/input/` (AETR channels, centre captured at rest, panel on key R). Old code took the centre from the last 100 samples, which is wrong unless the sticks end centred. |
| `rates.js` (791), `RatesUI.js` (471) | Betaflight/KISS rate curves and throttle curve | **Skip.** A RadioMaster applies its own rates and expo, and a plane has no FPV rate curve. Maybe a keyboard expo later. |
| `physics.js` (391) | Quadcopter: thrust along body-up, rate-mode control | **Not reusable as physics** (no lift, drag by airspeed or stall). **Reused:** quaternion integration, semi-implicit Euler, inertia-scaled response to commands, ground handling. New model: `shared/flight.js`. |
| `flightRecorder.js` (250) | Records inputs, pos, vel, quat, angular velocity per frame; export, load, interpolate | **Adapt, high value.** Swap `motors` for airspeed and alpha. Uses: replays as evidence for protests (ESA §4.19 is decided by a vote of the contestants), ghost/bot data, debugging netcode. |
| `GateDetector.js` + `track.checkSpecificGate` | Segment-versus-gate-plane crossing between two frames | **Adapt.** The same test detects safety-line crossings (§4.9: first −200, second = disqualified) and landing-zone entry (§4.6). About 20 lines on the server. |
| `CameraManager.js` (397) | FPV, chase and isometric cameras | **Adapt.** Add the view real pilots have: standing at the start pit looking at the plane. Plus chase and FPV. |
| `HUDRenderer.js` (313), `DOMCache.js` | Timers, messages, dirty-flag DOM updates | **Adapt** for the fight timers (7 min prep, flight time, points). |
| `RaceSystem.js`, `timing.js` (`LapTimer`) | Race state and lap timing | **Pattern only.** ESASIM needs a fight state machine (preparation, readiness, flight; §4.2) on the server. |
| `EventBus.js` (208) | Pub/sub | **Copy** for client-side UI events. |
| `GameState.js`, `SystemManager.js`, `migrationConfig.js` | Observable state, system lifecycle, migration flags | **Skip for now.** They exist because `main.js` grew to 88 globals and had to be unpicked. Colyseus already holds the shared state. Start modular and add these only if the client grows. |
| `ObjectPool.js` (271) | Reuse Vector3/Quaternion in hot paths | **Maybe later.** `shared/flight.js` allocates a few vectors per step; fine for now, matters with 7 planes at 240 Hz on the server. |
| `autopilot.js` (493), `aiRacing.js` (380) | Waypoint PID autopilot for a quad; AI drones with strategies | **Concept only.** A plane needs a different bot (pursuit of an enemy). But bots matter: they keep a room from being empty and give sparring partners. |
| `aiTrainer.js` (1 183), `trackEvolver.js` (355) | Genetic algorithm for trajectories and tracks | **Pattern.** Evolve bot gains by running `shared/flight.js` headless in Node. The flight model runs without a browser, which makes this cheap. |
| `TrainingSwarmSystem.js` (350) | Spectator view of many AI drones | **Adapt later** as audience/spectator mode and a bot-vs-bot viewer. |
| `LapRecorder.js` (415), `vision_ai_training/*`, `VisionAISystem.js` (752) | Imitation learning from human laps; vision-based gate detection | **Park.** Interesting later: learn bot behaviour from recorded human dogfights. Nothing to use now. |
| `sceneryManager.js` (248), `sceneries/*`, `MapSelector.js` | Lazy-loaded scenery registry, venue picker | **Adapt** for venues (flat airfield, meadow, hills) and a room/venue chooser. Field geometry stays fixed to the rules. |
| `debugTool.js` (693) | Gate and drone diagnostics with visual helpers | **Adapt later** for safety-line, streamer and prop-disc helpers. |
| `comparisonLogger.js` | Compares old versus migrated code paths | **Skip.** A migration tool. |

## Lessons from the old sim

- Keep the physics in a shared module that runs in Node and the browser (done: `shared/flight.js`). It enables server authority and headless training.
- Avoid a 3 700-line `main.js`: keep `client/` split by concern from the start.
- Keep calibration and mapping persistent and visible; it is what made the old sim pleasant with a real radio.

## Suggested order

1. Flight model tuning with Adam's radio (in progress).
2. Safety-line detection plus server-side scoring (reuses the gate-crossing idea).
3. Streamer plus prop-disc cut test (issue filed).
4. Flight recorder adapted, then replays.
5. Pilot-at-pit camera.
6. Bots.
