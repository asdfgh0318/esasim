# ESASIM

**Multiplayer browser sim of ESA (Electric Simple Aircombat)**, the Polish R/C air-combat class: small foam WWII fighters (70-86 cm, max 450 g), a 10 m paper streamer on every tail, up to seven pilots in one sky. Field, planes and scoring follow the [ESA regulations](http://www.aircombat.pl/ACES/forum/viewtopic.php?t=21) (unchanged for 2026).

> **This game is bait.** It exists to get you flying ESA air combat in the real world. If you like it, the in-game intro points to the real thing: rules, kits, build guides, squadrons and contests (Poland first, worldwide next).

![Air fight over the landing field, seen from the pilot's start box](docs/img/hero.png)

![Intro screen](docs/img/intro.png)

## What works now

- **A full ESA contest**: a waiting room, then rounds and a final (3 rounds + final per §4.1, points add up, ties by the final then the best single fight, §4.16). Each fight: preparation (test flights), readiness, a 5-minute flight, landing, results. Up to 7 pilots, humans and bots.
- **PicaSim-derived flight physics**: each plane is a rigid body flown by blade-element aerofoils (real stall curves, drag buckets, prop wash, ground effect) and a blade-element propeller with RPM dynamics, ported from [PicaSim](https://github.com/Rowlhouse/PicaSim) with ESA-specific plane definitions ([`docs/physics.md`](docs/physics.md)).
- **Advanced physics editor**: about 175 PicaSim-style parameters of your plane (wing CLPerDegree, flap fractions, control throws, propeller radius and torque, masses, positions, size/mass/drag/engine scales ...), searchable, with import and export. The weighed mass and the measured span still count for legality.
- **Streamers and cuts**: the 10 m streamer follows the tail's trace with turbulence wobble. A cut happens when the prop disc or the wing leading edge sweeps through an enemy streamer (swept tests, so fast passes don't tunnel).
- **ESA scoring** (§6, WWII): +1 per 3 s of flight (100 for the full time), +100 per cut (one attack = one cut), +50 for keeping your streamer, +20 for landing in the 50 x 20 m field after the end signal, −200 for crossing the safety line (second crossing: disqualified), −50 for avoiding combat.
- **Workshop**: tune your plane (type, span, battery, prop, ballast) inside the ESA limits (span 700-860 mm, 200-450 g, 15 Wh). The battery drains with throttle, so a bigger one is heavier but lasts. An illegal plane still flies but scores 0 for the round (§6).
- **Four modelled planes** (Spitfire, Hurricane, FW 190, Yak-3), built in OpenSCAD to ESA kit proportions.
- **Pursuit bots**, so you can test alone. Add up to six. Gusty air is shared by all planes.
- **Hand launch** like real WWII ESA, from your start box. **Pilot camera** standing at your start box and following the plane (default), or **analog-style FPV** (V): scanlines, snow and tearing grow with distance from you, ending in signal lost.
- **Textured sky** (procedural clouds and sun) and a **beginner orientation widget** in the top-right corner: your plane as you see it from the start box, with a yellow nose arrow, red (left) and green (right) wing lights and a plain-language label ("Nose toward you · banked left").
- **Analog FPV and video interference**: every plane carries a video transmitter (power 25 mW to 5 W, channel R1-R8). Range grows with power. Another pilot's transmitter near your start box, especially a 5 W one that forgot race mode, swamps your feed and you see *their* camera rolling through yours. Switch power and channel live (model in your hand). This is a sim effect, ESA has no VTX rules.
- **Replay**: after a fight, watch it back (scoreboard and events included) or save it as JSON, useful as evidence for protests (§4.19).
- **RadioMaster support** (any USB joystick-mode radio) with mapping and calibration (key R), ported from the author's earlier drone sim. Keyboard works too.
- The flight model, streamer, cut detection, scoring, series, workshop and bots are headless and covered by tests (`npm test`).

![Workshop with a limit violation](docs/img/workshop.png)
![The advanced physics editor](docs/img/physics-panel.png)
![Contest results with the winner](docs/img/results.png)
![The four OpenSCAD planes](docs/img/models.png)
![Waiting room: bots in their start boxes](docs/img/lobby.png)
![A running fight seen from the start box](docs/img/fight.png)
![Pilot view with the textured sky and the orientation widget](docs/img/pilot-view.png)
![Analog FPV close to the pilot](docs/img/fpv-near.png)
![Analog FPV far out: signal lost](docs/img/fpv-far.png)
![FPV interference from another pilot's 5 W transmitter](docs/img/interference.png)

The contest site is built from ESA §2: red = safety line, white = pilot line (3 m behind), green = readiness line, yellow = audience zone (behind the pilots), a slightly lighter mown patch with white tape = 50 x 20 m landing field, grey = 7 start boxes. Around it: a tree line, wheat fields, a powerline, wind turbines, banners, tents and flags (all VISUAL, generic names, no real brands), after photos of real ESA/ACES pitches (plain mown grass and tape lines). The rules do not give a flight-zone size, so that one is a design choice.

![Plan view of the ESA contest site](docs/img/field-plan.png)

## Play it

```bash
npm install
npm start        # game server (:2567) and client (http://localhost:5173) together
```

(`npm run server` and `npm run dev` start them separately.)

1. Open http://localhost:5173. Press **Add bot** a few times, **Ready**, **Start fight**. **Workshop** tunes your plane.
2. During preparation and flight press **Space** to throw your plane, then fly. Keyboard (same layout as the drone sim): **W/S pitch** (W = nose down), **A/D roll**, **Q/E yaw**, **Shift/Ctrl throttle**; arrows also pitch/roll. With a radio: plug it in (joystick mode), press **R** to map and calibrate.
3. Cameras: **P** pilot view (default), **V** analog FPV. The video transmitter (power, channel) is switched with the selectors bottom left, with the model in your hand; a 5 W transmitter reaches far but swamps other pilots' video when it flies near their box.
4. Others can join the same room from other browsers (`?server=<host>` if the server is on another machine). Without a server the page runs as offline practice.

### Play with a friend

- **Same network:** run `npm start`, find your address (`hostname -I`), and your friend opens `http://<your-address>:5173`. Both of you land in the same room (up to 7 pilots, bots included). Open ports 5173 and 2567 in your firewall if needed.
- **Over the internet:** expose both ports with a tunnel, for example two [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) quick tunnels (`cloudflared tunnel --url http://localhost:5173` and `cloudflared tunnel --url http://localhost:2567`). Your friend opens the first (https) address with `?server=wss://<second-address>` appended, e.g. `https://abc.trycloudflare.com/?server=wss://xyz.trycloudflare.com`.
- Pilot names: add `&name=Alice`. The friend flies with the keyboard (WASD, Q/E, Shift/Ctrl, Space) or a USB radio (press R).

Short phases for testing: `ESASIM_PREP=5 ESASIM_READY=2 ESASIM_FLIGHT=60 ESASIM_ROUNDS=1 npm run server`.

## Models

`models/scad/esa_plane.scad` is the source (needs `openscad`); `tools/build-models.sh` rebuilds the STLs in `public/models/`; `viewer.html?plane=all` previews them.

## Tests

`npm test` runs the flight model, streamer and cut detection, fight scoring (one check per §6 line), the workshop limits and battery, the contest series, a headless 5-minute bot fight, and a server integration test with real WebSocket clients.

## Honest status

- The physics engine is PicaSim's; the **ESA plane numbers on top of it are my estimates** (marked in `shared/picasim/esaDef.js`) and need real stick time. A hands-off launch needs full throttle (the keyboard launch sets it), and the glide is modest.
- Each browser flies its own plane and the server judges, so a modified client could cheat on its own flight.
- Not done yet: better 3D models (the OpenSCAD ones are stylised), stuck streamers (§4.11), the 'pilot in zone' procedure (§4.6), the WWI class, more of the "fly for real" research. See the [issues](https://github.com/asdfgh0318/esasim/issues).
- Bots land mid-field rather than for the +20 bonus. The RadioMaster panel has not been tested with real hardware. The workshop's mass and prop formulas are my estimates (listed in `shared/workshop.js`).

## Docs

- [`docs/rules.md`](docs/rules.md): the ESA rules, extracted with citations and mapped to the code
- [`docs/physics.md`](docs/physics.md): the PicaSim-derived flight physics, the ESA plane definitions, the parameter editor
- [`docs/rules-aces.md`](docs/rules-aces.md): the ACES fallback rules
- [`docs/fly-for-real.md`](docs/fly-for-real.md): verified Polish shops, guides, teams and contests (feeds the in-game intro)
- [`docs/drone-sim-audit.md`](docs/drone-sim-audit.md): what was reused from the earlier drone sim
- [`docs/models.md`](docs/models.md): the OpenSCAD planes, dimensions, licences and what was checked
- [`CLAUDE.md`](CLAUDE.md): plans, decisions and changelog

Every game rule in the code cites its § of the [ESA 2024 regulations](papers/poland/Regulamin_Aircombat_ESA_2024.pdf) (see [`shared/rules.js`](shared/rules.js)); ESA falls back to the international ACES rules for anything it does not cover. The PDFs in `papers/` govern over any summary in this repo.

## Licence

ESASIM is open source for hobbyists: [PolyForm Noncommercial 1.0.0](LICENSE) (use, study, change and share for any noncommercial purpose). That licence is also what lets it build on PicaSim's physics; see [`NOTICE`](NOTICE).

## Credits

ESA and ACES rule documents belong to their authors (ACES Polska, aircombat.eu), included for reference. Flight physics derived from [PicaSim](https://github.com/Rowlhouse/PicaSim) by Danny Chapman. Sky and grass textures: [Poly Haven](https://polyhaven.com/license), CC0 (Greg Zaal, Jarod Guest, Charlotte Baglioni). Built by [asdfgh0318](https://github.com/asdfgh0318), vibecoded with Claude Code. Earlier sim: [fpv_simulator](https://github.com/asdfgh0318/fpv_simulator).
