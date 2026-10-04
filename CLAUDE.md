# ESASIM

Multiplayer web RC-plane simulator for an ESA competition. Status: **planning, nothing built yet.**

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

The original rule documents are saved, and committed, in `papers/` (PDFs plus an `aircombat.eu_rules_index.htm` snapshot of the source page, fetched 2026-10-04).
- The competition is **ACES R/C Air Combat** (aircombat.eu), WWII class, 1:12 warbirds, streamer cutting. The prompt said "ESA"; that word is not in any of the documents.
- Primary: `papers/2023_ACES_int_WWII Rules.pdf`. Extract with page/§ cites: `docs/rules.md` (the PDFs govern if they disagree).
- **Every game-rule decision (field size, scoring, limits, plane validation) must name the § it follows, in code comments and in the Changelog.** If the rules are silent, say so and log it as a design choice in `docs/rules.md` "Open points".
- Read so far: 2023 int WWII, Appendix 3-1, points table (Appendix 4-5). Downloaded but not read: 2016 int WWII and WWI, 2011 WWII, German ACES-D WWII 2016/2023 and WWI 2016, 2019 ACES-D EPA (49 pp, a different class).
- Field per rules: landing field 20 x 75 m, safety line 5-10 m in front of the pilot line, 7 start pits 3 x 3 m, readiness line 10 m behind. The flight area size is NOT specified.

## Product intent: the game is bait (Adam, 2026-10-04)

The game is a lure to get people flying ACES air combat in real life. The intro page must say so (done: `#intro` in `index.html`) and point to real-world resources: shops with ACES planes, documents, YouTube how-to-start videos, teams/clubs. Only verified links go on the page (currently just aircombat.eu). The rest is TODO: research it, download or read each source (global rule), keep it in `docs/fly-for-real.md`, then link it from the intro. No invented shops or links.

## Reference project

`../symulator_fpv` (github.com/asdfgh0318/fpv_simulator): Three.js 0.160 via importmap, plain ES modules, no bundler. Worked well. Reuse ideas (input/gamepad mapping, rates, flight recorder, ghost, scenery loader), not necessarily code.

## Open questions (blocking)

Answered 2026-10-04: rules = http://aircombat.eu/rules.htm (ACES); format = shared-sky air combat, everything per ACES rules (field dimensions included) first; a workshop to build and modify planes comes later; repo = public asdfgh0318/esasim.
Still open:
1. Flight area size (rules silent), spectator/pilot camera positions.
2. How a streamer cut is detected.
3. First plane to ship (waiting for Adam's models).
4. Research for the intro: shops, plans, YouTube, teams (Poland first?).

## Plan (draft, revised after the answers above)

1. DONE: rules extracted into `docs/rules.md`.
2. Stack chosen (versions checked on npm 2026-10-04): Vite 8 + Three.js 0.186 (client), Colyseus 0.18 (server, up to 7 players per room = §4.1), custom flight model. Rapier (0.21) only if collision needs it. The old sim's Three 0.160 is outdated, so not reused as-is.
3. Walking skeleton: one plane flying in the browser with gamepad and keyboard.
4. Netcode: authoritative server, client prediction, 2 players in one room.
5. Model pipeline: glTF import for Adam's ESA models, with a per-model parameter file (mass, wing area, thrust).
6. Scoring and rules enforcement from step 1.

## Changelog

- 2026-10-04: Created CLAUDE.md.
- 2026-10-04: Downloaded ACES rules to `papers/`, wrote `docs/rules.md`. Found ESA = ACES air combat.
- 2026-10-04: Scaffold done: `shared/rules.js` (constants with § cites), `client/field.js` (Fig 1 site to scale), `client/main.js` (placeholder plane, offline-safe), `server/index.js` (Colyseus room, 7 clients §4.1, pose relay). `vite build` passes, server boots, headless screenshots OK. Two-client sync not yet tested.
- 2026-10-04: Intro overlay with the "this game is bait" message. Flight area 150 x 100 m is a DESIGN value (rules silent).
- 2026-10-04: Added README with screenshots.
