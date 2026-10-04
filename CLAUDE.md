# ESASIM

Multiplayer web RC-plane simulator for **ESA (Electric Simple Aircombat)**, a Polish R/C air-combat class: foam WWII-style fighters cutting each other's paper streamers. Status: early skeleton, flyable offline.

## First prompt (verbatim, 2026-10-04)

> hi i want to make another sim for esa rc planes multiplayer web app competition use existing frameworks if you think they are recent enoughh i already built simulator of drones here and it worked quite well i will focus on finding nice esa models for you but start from reading esa rules and preparing sim framework lets focus on details later make claude.md with this first proompt saved there as well but make all plans and changes there go for some smaller but in need of opus tasks you can use it but be carefull i dont have lots of usage on it and i  want to vibecode make github with readme with nice pictures and intro ask me more questions

## Working rules (derived from the prompt)

- Record **all plans and changes in this file** (see Plan and Changelog below).
- Prefer existing, actively maintained frameworks over writing from scratch.
- Adam supplies the ESA plane models; Claude does rules + sim framework first, details later.
- Opus usage is limited: use it only for small, hard tasks (e.g. flight dynamics, netcode design). Do routine work on the default model.
- Vibecoding style: small steps, runnable at every step.
- GitHub repo with README: intro and nice pictures.
- Research rule (global CLAUDE.md): download every cited source into `papers/`; no claim from snippets. ESA rules must be read from the PDF.

## Rules are in this repo: cite them for every decision

**CORRECTION 2026-10-04:** I first took "ESA" for ACES (the international 1:12 class at aircombat.eu) and built on the ACES rules. That was wrong. ESA = **Electric Simple Aircombat**, a Polish class with its own regulations: foam only, WWII span 700-860 mm, max 450 g, max 15 Wh, 10 m x 1 cm crepe-paper streamer, 5 min flight, hand launch. ESA §1.2 falls back to ACES for anything it does not cover.

- **Primary:** `papers/poland/Regulamin_Aircombat_ESA_2024.pdf` (valid "od sezonu 2024", forum says 2024 and 2025). Extract with § cites: `docs/rules.md`. The PDF governs if they disagree.
- **Version:** the official 2026 announcement (Rozkaz KG ESA #2026/03, `papers/poland/forum_esa_t234_...`) says the regulation is unchanged from 2024/2025, so the 2024 PDF is current (verified 2026-10-04).
- **Fallback only:** ACES PDFs in `papers/`, extract in `docs/rules-aces.md`. Never use ACES values for ESA (1:12, 500-1500 g, 12 m streamer, 7 min are ACES).
- Also saved: ESA 2022 rules, forum threads and event pages in `papers/poland/` (fetched 2026-10-04).
- **Every game-rule decision (field, scoring, limits, plane validation) must name the § it follows, in code comments and the Changelog.** If the rules are silent, say so and log it as DESIGN in `docs/rules.md` "Open points".
- Field per ESA: safety line 0 m (flight zone in front), pilot line 3 m behind, readiness line 5-8 m behind the pilot line, audience >= 10 m behind the safety line, landing field 50 x 20 m from the safety line, up to 7 pilots, WWII hand launch. Flight-zone size and start-box size are NOT specified.

## Product intent: the game is bait (Adam, 2026-10-04)

The game is a lure to get people flying ACES air combat in real life. The intro page must say so (done: `#intro` in `index.html`) and point to real-world resources: shops with ACES planes, documents, YouTube how-to-start videos, teams/clubs. Only verified links go on the page (currently just aircombat.eu). The rest is TODO: research it, download or read each source (global rule), keep it in `docs/fly-for-real.md`, then link it from the intro. No invented shops or links.

## Decisions (Adam, 2026-10-04)

- **Streamer / cut detection:** simplest version. The 10 m streamer (ESA §3.7) follows the recorded trace of the plane's tail, with some extra wobble for turbulence. A cut is a streamer segment intersecting the enemy **prop disc**. Rule details (ESA §4.11): several cuts in one attack count once; a cut plus a collision-kill counts only if the cutting plane can keep flying.
- **Classes:** ESA is electric by definition. WWII class first (single-engine); ESA WWI (ground posts, ground launch, 1000 mm span) later. ACES classes are out of scope unless Adam asks.
- **Input:** Adam flies with a **RadioMaster**; the radio pipeline and calibration UI from the drone sim are ported (`client/input/`, panel on key R). Keyboard is the fallback. Not tested with real hardware yet.
- **Physics:** the drone sim's quad physics does not transfer; new fixed-wing model in `shared/flight.js` (runs in Node and browser), params per plane in `shared/planes/`. See `docs/drone-sim-audit.md` for what else is reusable.
- **Models:** Adam supplies them; see `docs/models.md`. Until then `shared/planes/esa-wwii.js` is a generic foam plane (all numbers DESIGN except the rule limits).
- **Spawn:** one plane per start box (7), held in the pilot's hand at the pilot line, Space = hand launch (ESA §4.4, §2.2.5). (Adam: "use rules".)
- **Research order for the intro page:** Poland first, then worldwide (Adam, 2026-10-04).
- "Fly for real" research is tracked as GitHub issues, not done yet.

## Reference project

`../symulator_fpv` (github.com/asdfgh0318/fpv_simulator): Three.js 0.160 via importmap, plain ES modules, no bundler. Worked well. Reuse ideas (input/gamepad mapping, rates, flight recorder, ghost, scenery loader), not necessarily code.

## Open questions (blocking)

Answered 2026-10-04: rules = http://aircombat.eu/rules.htm (ACES); format = shared-sky air combat, everything per ACES rules (field dimensions included) first; a workshop to build and modify planes comes later; repo = public asdfgh0318/esasim.
Still open:
1. Flight-zone size (rules silent).
2. How a streamer cut is detected.
3. First plane to ship (waiting for Adam's models).
4. Research for the intro: shops, plans, YouTube, teams (Poland first, then worldwide; issue #1).

## Plan (draft, revised after the answers above)

1. DONE: ESA rules extracted into `docs/rules.md` (after the ACES mix-up, see correction above).
2. Stack chosen (versions checked on npm 2026-10-04): Vite 8 + Three.js 0.186 (client), Colyseus 0.18 (server, up to 7 players per room = ESA §4.1), custom flight model. Rapier (0.21) only if collision needs it. The old sim's Three 0.160 is outdated, so not reused as-is.
3. Walking skeleton: one plane flying in the browser with gamepad and keyboard.
4. Netcode: authoritative server, client prediction, 2 players in one room.
5. Model pipeline: glTF import for Adam's ESA models, with a per-model parameter file (mass, wing area, thrust).
6. Scoring and rules enforcement from step 1.

## Changelog

- 2026-10-04: Created CLAUDE.md.
- 2026-10-04: Downloaded ACES rules to `papers/`, wrote `docs/rules.md`. Found ESA = ACES air combat.
- 2026-10-04: Scaffold done: `shared/rules.js` (constants with § cites), `client/field.js` (Fig 1 site to scale), `client/main.js` (placeholder plane, offline-safe), `server/index.js` (Colyseus room, 7 clients §4.1, pose relay). `vite build` passes, server boots, headless screenshots OK. Two-client sync not yet tested.
- 2026-10-04: Intro overlay with the "this game is bait" message. Flight area 150 x 100 m is a DESIGN value (rules silent).
- 2026-10-04: Added README with screenshots. Pushed first commit to github.com/asdfgh0318/esasim.
- 2026-10-04: Flight model v0 (`shared/flight.js`, `shared/planes/fw190d.js`, `test/flight.test.js`, all 6 checks pass). Params from the FW-190D plan (span 875 mm, 820 g, 9x4.7 prop). Thrust, drag, stability numbers are DESIGN guesses to tune with real stick time. Known weak spot: power-off glide is steep (about 5 m/s sink at 21 m/s, L/D around 4).
- 2026-10-04: Ported the radio pipeline (`client/input/radio.js`, `radioUI.js`), client now flies the new model. Audit written: `docs/drone-sim-audit.md`. Plans for FW-190D and Fiat G.55 saved in `models/plans/`.
- 2026-10-04: **Correction:** ESA is Electric Simple Aircombat (Polish), not ACES. Found via the Polish event "XII Bitwa ESA i VIII Bitwa ACES o Płock". Downloaded ESA 2022/2024 rules and Polish pages to `papers/poland/`, rewrote `docs/rules.md` for ESA (old ACES extract kept as `docs/rules-aces.md`), `shared/rules.js` now ESA constants, field rebuilt per ESA §2, new generic ESA plane (`shared/planes/esa-wwii.js`, 400 g, 800 mm), hand launch (`Plane.launch`, Space), intro text fixed. Flight tests pass (hand launch, rates, stall). The FW-190D (820 g) is not ESA-legal, kept as reference only.
- 2026-10-04: Poland-first research for the intro (issue #1): verified shops (ef3m.pl, napolskimniebie.pl), build guides, squadrons/calendar 2026, one contest video; written in `docs/fly-for-real.md`, linked from the intro. Dropped unverified links (RCTRAX 404, Cyber-Fly, modelerc.info). Removed pages with private emails from the repo. 2026 rules confirmed unchanged. Worldwide pass still to do.
