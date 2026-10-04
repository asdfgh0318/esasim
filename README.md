# ESASIM

**Multiplayer browser sim of ESA (Electric Simple Aircombat)**, the Polish R/C air-combat class: small foam WWII fighters (70-86 cm, max 450 g), a 10 m paper streamer on every tail, up to seven pilots in one sky. Field, planes and scoring follow the [ESA regulations](http://www.aircombat.pl/ACES/forum/viewtopic.php?t=21) (unchanged for 2026).

> **This game is bait.** It exists to get you flying ESA air combat in the real world. If you like it, the in-game intro points to the real thing: rules, kits, build guides, squadrons and contests (Poland first, worldwide next).

![Intro screen](docs/img/intro.png)

## What works now

- **A full ESA fight**: waiting room, preparation (test flights), readiness, a 5-minute flight, landing, results. Up to 7 pilots, humans and bots.
- **Streamers and cuts**: the 10 m streamer follows the tail's trace with turbulence wobble. A cut happens when the prop disc or the wing leading edge sweeps through an enemy streamer (swept tests, so fast passes don't tunnel).
- **ESA scoring** (§6, WWII): +1 per 3 s of flight (100 for the full time), +100 per cut (one attack = one cut), +50 for keeping your streamer, +20 for landing in the 50 x 20 m field after the end signal, −200 for crossing the safety line (second crossing: disqualified), −50 for avoiding combat.
- **Pursuit bots**, so you can test alone. Add up to six.
- **Hand launch** like real WWII ESA, from your start box. **Pilot camera** standing at the start box with zoom, plus chase and FPV cameras.
- **RadioMaster support** (any USB joystick-mode radio) with mapping and calibration (key R), ported from the author's earlier drone sim. Keyboard works too.
- The flight model, streamer, cut detection, scoring and bots are headless and covered by tests (`npm test`).

![Waiting room: bots in their start boxes](docs/img/lobby.png)
![A running fight seen from the start box](docs/img/fight.png)
![Chase camera, own plane with its streamer](docs/img/chase.png)

The contest site is built from ESA §2: red = safety line, white = pilot line (3 m behind), green = readiness line, yellow = audience zone, tan = 50 x 20 m landing field, grey = 7 start boxes. The rules do not give a flight-zone size, so that one is a design choice.

![Plan view of the ESA contest site](docs/img/field-plan.png)

## Play it

```bash
npm install
npm run server   # Colyseus on :2567
npm run dev      # client on http://localhost:5173
```

1. Open http://localhost:5173. Press **Add bot** a few times, **Ready**, **Start fight**.
2. During preparation and flight press **Space** to throw your plane, then fly. Controls: arrows pitch/roll, A/D rudder, W/S throttle. With a radio: plug it in (joystick mode), press **R** to map and calibrate.
3. Cameras: **P** pilot box, **C** chase, **V** FPV.
4. Others can join the same room from other browsers (`?server=<host>` if the server is on another machine). Without a server the page runs as offline practice.

Short phases for testing: `ESASIM_PREP=5 ESASIM_READY=2 ESASIM_FLIGHT=60 npm run server`.

## Tests

`npm test` runs the flight model, streamer and cut detection, fight scoring (one check per §6 line), a headless 5-minute bot fight, and a server integration test with real WebSocket clients.

## Honest status

- Flight and streamer numbers are design estimates (marked `DESIGN` in the code). They need real stick time; the generic plane is not a specific model yet.
- Each browser flies its own plane and the server judges, so a modified client could cheat on its own flight.
- Not done yet: real 3D models, the plane workshop, stuck streamers (§4.11), the WWI class, the flight recorder, the worldwide "fly for real" research. See the [issues](https://github.com/asdfgh0318/esasim/issues).
- Bots land mid-field rather than for the +20 bonus. The RadioMaster panel has not been tested with real hardware.

## Docs

- [`docs/rules.md`](docs/rules.md): the ESA rules, extracted with citations and mapped to the code
- [`docs/rules-aces.md`](docs/rules-aces.md): the ACES fallback rules
- [`docs/fly-for-real.md`](docs/fly-for-real.md): verified Polish shops, guides, teams and contests (feeds the in-game intro)
- [`docs/drone-sim-audit.md`](docs/drone-sim-audit.md): what was reused from the earlier drone sim
- [`docs/models.md`](docs/models.md): what plane models are needed
- [`CLAUDE.md`](CLAUDE.md): plans, decisions and changelog

Every game rule in the code cites its § of the [ESA 2024 regulations](papers/poland/Regulamin_Aircombat_ESA_2024.pdf) (see [`shared/rules.js`](shared/rules.js)); ESA falls back to the international ACES rules for anything it does not cover. The PDFs in `papers/` govern over any summary in this repo.

## Credits

ESA and ACES rule documents belong to their authors (ACES Polska, aircombat.eu), included for reference. Built by [asdfgh0318](https://github.com/asdfgh0318), vibecoded with Claude Code. Earlier sim: [fpv_simulator](https://github.com/asdfgh0318/fpv_simulator).
