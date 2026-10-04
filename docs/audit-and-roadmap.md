# ESASIM audit and roadmap (2026-10-04)

Read-only audit of the code at commit `ef9e8c0`, the docs and `papers/poland/Regulamin_Aircombat_ESA_2024.txt`. Nothing in the code was changed. The rules PDF governs over this document. Where this document and `CLAUDE.md` disagree about decisions, `CLAUDE.md` (Adam's decisions) governs.

## Status (updated 2026-10-04, same day)

Done since this audit (see `CLAUDE.md` changelog for details): R1, R2, R3, R5, N4, N6, N3/N8 basics (message shape, teleports, fake flags), N1 (lag-compensated cuts, `docs/netcode.md`), N2 (own streamer local, remote interpolated), N5/N7 (reconnect, private rooms, host), E1 (CI), E2 (single-port serving, LAN tested, tunnel not tested), E5 wording, B1 (bots crash far less), P3/U4 (keyboard ramp and expo, gamepad presets), U1 (Polish UI draft), G1 (after-fight call to action), contest rooms without the physics editor (`?strict=1`). Also done in the finish round: R4 (ground crossings; the wing/tail tolerance in the air stays a DESIGN question), R7, R10-R13 (logged as DESIGN or fixed), N9, B2, U2, U3, U1 (complete). **Still open:** R6, R8, R9, P1/P2/P5 (needs real plane measurements), B3, U4 (hardware), U5, E4, E6-E7, G2-G5, Paths B, C (rest), D.

## Verdict

1. The core is good. The rules engine (`shared/fight.js`) follows ESA §6 closely, and every rule cites its §. It is pure logic with no network code, so it is easy to test, and 111 checks pass (`npm test`, 44 s, run today).
2. The weakest part is the online play. Each browser reports its own position and the server believes it, so a modified client can cheat in many ways. There is no lag compensation (correcting for network delay), so over the internet cuts will feel random. A dropped Wi-Fi connection loses your whole contest score.
3. The bots fly, but they crash and relaunch about 13 times in a 5-minute fight (in the run today, 40 launches for 3 bots). The physics glides at about 3:1, which is probably too steep for a foam warbird. Neither has been checked against a real plane yet.
4. Playing with a friend over the internet, as the README describes it, very likely fails. Vite's dev server blocks unknown host names such as `*.trycloudflare.com` unless `allowedHosts` is set, and there is no `vite.config`. There is also no CI (tests that run automatically on GitHub) and no public deployment.
5. As bait for real ESA, the game has good verified Polish links. But the UI is English-only for a Polish scene, and the game has no "next step" after a fight. That after-fight moment is the best place to recruit players.

## How sure I am

- **Verified (I read the code, or ran it):** all file:line findings below, the test run (111 ok, 44.3 s wall clock), the bot fight statistics (40 launches and 40 landings for 3 bots in 300 s, 8 cuts), the glide numbers in the test output (14.0 m/s, sink 4.3 m/s, L/D 3.2), and the Vite host check (I read `isHostAllowedInternal` in `node_modules/vite/dist/node/chunks/node.js:16804`). Also verified: there is no `.github/` folder and no `vite.config.*`.
- **Inferred, not run:** that the cloudflared instructions fail. I did not start a tunnel. The task forbids starting servers.
- **Inferred, not run:** that a bot crossed the safety line in `test/series.test.js`. The score arithmetic says so: Bot3 had −70 after two 45 s fights, and −200 + 100 + about 30 is the only combination that fits.
- **Assumed:** real-world numbers for ESA planes (glide ratio, top speed). I downloaded no source for them, so they are marked as "to measure" and never stated as facts.
- **Estimated:** network bandwidth, from the snapshot contents.
- **Not checked:** browser performance, the RadioMaster on real hardware, and mobile.

## Findings

Severity: **High** = breaks fairness or play for real users. **Medium** = wrong against the rules or noticeably weak. **Low** = polish.

### 1. Rules fidelity (ESA 2024)

| # | Finding | Sev. | Evidence |
|---|---|---|---|
| R1 | An illegal workshop build (over the mass or battery limit) scores 0 only in round 1. `Arena.restart()` makes a new `Fight`, and `addPilot` sets `illegal: false` again. The illegal plane then scores normally in round 2, round 3 and the final. §6 says "0 pkt za rundę" (0 points for the round), and the plane is the same. | High | `shared/fight.js:30`, `shared/arena.js:49`, `shared/arena.js:163-171` |
| R2 | A plane launched in prep (test flights are allowed by §4.2.1) can stay in the air through readiness into the flight. That plane never gets a "launch" during the flight, so `launches = 0` and `lastLaunchT = -1`. The pilot then silently loses the +50 streamer-protection bonus and the +20 landing bonus. Also, §4.2.2 says models stay in the start boxes during readiness, and nothing forces them down. | High | `shared/fight.js:78-79`, `:102`, `:133`. `client/main.js:77` |
| R3 | §4.9 disqualification is from the whole contest ("nie może kontynuować zawodów", may not continue the contest). The code only disqualifies for the current fight, because `restart()` clears it. | Medium | `shared/arena.js:163-171` |
| R4 | Safety line (§4.9). The code checks a single point, the centre of gravity. The rules say the model in the air must be "wyraźnie cały" (clearly, all of it) on the field side. On the ground, the motor's position counts. The tolerance for a wing or tail over the line, with the motor on the field side, follows the ground sentence, so it is ambiguous whether it applies in the air. Ground crossings ("porusza się na ziemi", moving on the ground) are not checked at all, because the check requires `airborne`. Open issue #14. | Medium | `shared/fight.js:89-95` (the `lineActive && p.airborne` test) |
| R5 | §4.11: "if several streamers are cut in one attack, it counts as one cut". The code groups cuts per victim (a 2 s window), so one pass through two different pilots' streamers scores 200. | Medium | `shared/fight.js:107-116` (`lastCutOn` is per victim) |
| R6 | §4.11 stuck streamers (a streamer caught on a model, cuts on it count, losing it costs nothing) are not modelled. The cut-plus-collision rule cannot apply either, because planes pass through each other: there is no collision code anywhere in `shared/`. | Medium | issue #10; `grep collision` finds nothing |
| R7 | §4.11 counts cuts "w powietrzu" (in the air) on attached streamers. The code also lets you cut the streamer of a plane lying on the ground, during the 4 s before it respawns. This is rare in practice. | Low | `shared/arena.js:128` (no victim-airborne check) |
| R8 | Pilot in zone (§2.2.1, §4.6, §4.15, §6 −50, and −50 for a low pass during "pilot w strefie"). It is not modelled: any plane, wherever it lands, is back in the hand after 4 s. That includes landing outside the flight zone, where §2.2.1 says it may not be picked up until the others have landed. `SCORING.zoneWithoutPermission` is defined but never used. Open issue #13. | Medium | `shared/arena.js:17`, `:112`; `client/main.js:199-200`; `shared/rules.js:24` |
| R9 | The flight-zone limits (100 x 80 m, DESIGN) are drawn on the field but not enforced: nothing happens when a human flies outside them. The rules leave the size to the organiser (§2.2.1), so this is a design gap, not a rule break. | Low | `shared/rules.js:13` |
| R10 | Landing bonus (§4.7, §6 +20): any touchdown in the field counts, crashes included. The rule says "lądowanie" (landing), which is the judge's call. The bots deliberately skip the bonus. | Low | `shared/fight.js:99-104`, `shared/bot.js:28` |
| R11 | A mass under 200 g, or a span outside 700-860 mm, gives 0 points. §6 only zeroes the round for exceeding the mass or battery limit. The other limits are scrutineering (the plane is not admitted). This is defensible, but it should be logged as DESIGN. | Low | `shared/workshop.js:25-31` |
| R12 | Non-engagement (§4.14) means "within 30 m of an airborne opponent" (DESIGN). The rule's exception for technical problems (land at once) is not modelled. Disqualified pilots can still get the +50 protection bonus. | Low | `shared/fight.js:8`, `:118-129`, `:133` |
| R13 | The VTX channel code comment cites §1.2/§4.17. Those paragraphs are about radio transmitter frequencies. ESA has no FPV or VTX rules, as the README itself says. The citation is misleading. | Low | `shared/arena.js:34` |
| OK | These were checked and match the rules: flight points with the 100 cap (§6, §4.5), +100 cut, −200 per crossing and disqualification on the second crossing within a fight, hand launch from the pilot line (§4.4), relaunch from the pilot line (§4.6), 2-7 pilots (§4.1), 3 rounds + final with points added up (§4.1), tie-break by the final, then by the best single fight (§4.16), 10 s airborne for protection (§4.10), landing bonus only if the last launch was at least 10 s before the end (§4.7), and battery ≤ 15 Wh nominal (§3.4). | | `test/fight.test.js`, `test/series.test.js` |

### 2. Netcode and cheating

Background: the game is **client-authoritative** for flight. Each browser simulates its own plane and sends its position 20 times a second. The server believes it and judges cuts and scores.

| # | Finding | Sev. | Evidence |
|---|---|---|---|
| N1 | **No lag compensation** (correcting for network delay). The server checks cuts with the newest reported pose of each plane, and each pose is late by that player's own delay. The attacker sees the victim's streamer late by one network trip, plus up to 66 ms between snapshots, plus about 70 ms of display smoothing. At 15-20 m/s, 150 ms of total delay is 2-3 m of error, against a hit zone of about 1 cm of paper plus 3 cm of tolerance plus the 11 cm prop radius. Over the internet, a cut seen on screen will often not count, and the other way round. | High | `shared/arena.js:124-132`, `server/index.js:9` (30 Hz tick, snapshot every 2nd tick), `client/main.js:203` |
| N2 | Your **own streamer is drawn from the server's snapshot**, not locally. Online, it trails detached from your tail by about speed × round-trip time (2-3 m on a typical connection). Other planes' streamers are drawn from raw 15 Hz snapshots, while their meshes are smoothed, so ribbon and plane do not line up. | High | `client/main.js:152-158` (views are updated for every id, including mine), `:204` (local streamer only offline) |
| N3 | **Easy cheats.** The client can (a) teleport or fly at any speed, (b) send `airborne:false` while crossing the safety line, which avoids the −200 (the check needs `airborne`), (c) send `airborne:true` while sitting on the ground to collect flight points, and (d) toggle `held:true` in the air, which wipes its own streamer trace and makes it uncuttable for a moment. (e) The advanced physics panel lets anyone set motor torque, drag and even the battery's mass shape (which lowers the weighed mass) and still be "legal". Humans are not simulated on the server, so the server never checks how the plane actually flies. | High (online), Low (with friends) | `shared/arena.js:77-84`, `shared/fight.js:89`, `shared/picasim/overrides.js:22-31`, `shared/workshop.js:23` |
| N4 | **Alt-tab freeze.** A hidden browser tab stops `setAnimationLoop`. The last pose stays `airborne:true` on the server, which has no pose timeout, so the plane hangs frozen in the air and keeps collecting flight points. | High | `client/main.js:180`, `:218-221`; no timeout in `server/index.js` |
| N5 | **No reconnection.** `onLeave` removes the pilot at once (`allowReconnection` is never used), and series totals are keyed by session id. A Wi-Fi blip loses the whole contest. Changing your plane reloads the page, which is the same as leaving. The client does not notice when it drops either: it has no `onLeave`/`onError` handler and keeps flying "online" among frozen planes. | High | `server/index.js:39`; `client/main.js:63`, `:168-175` |
| N6 | **Bots and humans share the 7 pilot slots, but the room's limit counts only humans.** With 5 bots and 2 humans, a third human joins as a silent ghost: `addHuman` returns null, the client is told "pit 0", and its poses are ignored. | Medium | `server/index.js:12`, `:35-36`; `shared/arena.js:43-44` |
| N7 | **One public room.** `joinOrCreate("combat")` puts everyone into one shared room. Colyseus opens a second room when the first is full, so strangers are split at random. There are no private room codes or "invite a friend" links, and no host: anyone can press Start, Add bot or Remove bots. Players can also join in the middle of a fight. | Medium | `server/index.js:19-22`, `:42`; `client/main.js:168` |
| N8 | **No input checks.** A pose without a `quat`, or with NaN numbers, reaches `THREE.Quaternion.fromArray` and the cut maths. Whether Colyseus 0.18 catches the exception is not verified. | Medium | `shared/arena.js:77-80` |
| N9 | The wind differs between client and server: the client uses `performance.now()`, the server uses `arena.t`. So "everyone flies in the same air" is not true online. | Low | `client/main.js:196`, `shared/arena.js:106` |
| N10 | Bandwidth (my estimate): one snapshot has 7 planes, each with a 21-point streamer, plus the score table, about 4-6 KB. At 15 Hz that is about 0.6 Mbit/s down per player and about 4 Mbit/s up from the host with 7 players. That is fine on a VPS (a rented server) and borderline on a home upload behind a tunnel. | Low | `shared/arena.js:173-182` |

### 3. Physics (`shared/picasim/` port)

| # | Finding | Sev. | Evidence |
|---|---|---|---|
| P1 | Power-off glide is 14 m/s with a 4.3 m/s sink, an L/D (glide ratio: metres forward per metre down) of 3.2. The test even accepts anything above 2.7. The docs blame the drag of the windmilling prop. A light foam warbird probably glides noticeably better, but that is an assumption to measure, not a cited fact. | Medium | test output; `test/picasim.test.js:35`; `docs/physics.md` |
| P2 | Every aerodynamic and mass number is an estimate. The ones tuned to get a behaviour are: 2.5° tail incidence (set so a hands-off launch works), maxTorque 0.06, and drag coefficients. The static thrust of 5.6 N (575 g, a thrust-to-weight of about 1.8) looks high next to the kit's "min 300 g thrust". It was not checked against a real motor and prop. | Medium | `shared/picasim/esaDef.js` (AEROFOILS, engines), test output lines 18-19 |
| P3 | With full deflection, the roll rate is 412°/s and the pitch rate 233°/s. The **keyboard is all-or-nothing** (a key gives −1, 0 or +1 at once, with no ramp or expo, a curve that softens the stick around centre), so a keyboard pilot gets snap rolls. This is probably the biggest reason a newcomer crashes. | Medium | `client/main.js:192-194`, test output line 24 |
| P4 | There are no collisions and no drag from the streamer on its own plane. The 10 m crepe streamer has no physics: it only replays the tail's path. This is a deliberate simplification. | Low | `shared/streamer.js` header |
| P5 | Top speed in level flight is not tested for the PicaSim model (only for the old `flight.js`). The cruise speed and the envelope (the range of speeds and loads the plane can fly) are unknown. | Low | `test/picasim.test.js` |
| P6 | Performance is fine: 20 s of flight computes in 305 ms for one plane, so 6 bots on the server use about 10 % of one CPU core. | OK | test output line 34 |

### 4. Bots

| # | Finding | Sev. | Evidence |
|---|---|---|---|
| B1 | Bots crash or land about every 22 s (40 launches for 3 bots in 300 s). A real ESA fight has a few launches per pilot, so the bots look clumsy and give away many points. | High | test output; `shared/arena.js:112` |
| B2 | There is a single skill level (0.7), and "skill" only adds stick noise. There are no difficulty levels in the UI and no "trainer" bot that flies slowly and straight for beginners. | Medium | `shared/arena.js:51`, `shared/bot.js:57` |
| B3 | The tactics are simple: always chase the nearest airborne enemy. Bots never defend their own streamer, never chase the +20 landing bonus, and never fight below z = 20-30 m. The landing field (0-20 m) is bot-free, so a human can hide there. | Medium | `shared/bot.js:21`, `:25`, `:28`, `:31` |
| B4 | Safety-line slips: 0 in the 5-minute test today. The series test probably had one (see "How sure I am"), and it does not check for slips. The tests are not repeatable, because the arena uses `Math.random` for bot ids, launch times and VTX settings. | Medium | `shared/arena.js:37`, `:48`, `:55`, `:112`; `test/bot.test.js:25` |
| B5 | Bots get perfect positions and velocities of everyone, with no delay or reaction time. That is fine for now. Adding a delay is a cheap way to make difficulty levels. | Low | `shared/arena.js:97-100` |

### 5. Client UX and visuals

| # | Finding | Sev. | Evidence |
|---|---|---|---|
| U1 | **English only** (`<html lang="en">`, every HUD string), while the scene, the shops and the clubs are Polish. | High (for the bait) | `index.html:2`, `client/hud.js:27-34` |
| U2 | Onboarding is hard. The camera stands at the pilot box (realistic, and a chase camera was removed on purpose), the keyboard is all-or-nothing, and there is no tutorial, practice task or "first flight" guide. The orientation widget helps, but on its own it is not enough. | High | `client/camera.js`, `client/main.js:192-194` |
| U3 | No sound at all: no whistle for start and end (ESA §4.2.3 uses a whistle signal), no motor sound, no cut sound. Sound is the cheapest immersion there is. | Medium | `grep audio` finds nothing in `client/` |
| U4 | No touch or mobile controls. A phone can open the page but cannot fly. A gamepad works through the radio code, but the default AETR mapping (aileron, elevator, throttle, rudder on axes 0-3) puts throttle on a centred stick for an Xbox-style pad. There are no pad presets. The RadioMaster path is untested on hardware (issue #4). | Medium | `client/input/radio.js:9`, `:29-31` |
| U5 | Accessibility: the orientation widget's wing lights and several pilot colours are red/green, the hardest pair for colour-blind players. Events appear only as 4 s text toasts. The HUD font is 11-12 px. The keys cannot be remapped. | Low | `client/main.js:39`, `client/hud.js` |
| U6 | The streamer is drawn 7 cm wide (7× real) so it can be seen from the box. The hit zone is about 4 cm plus the prop, so it looks hittable when it is not. Partly a side effect of N1. | Low | `client/streamerView.js:6`, `shared/cut.js:52` |
| U7 | Performance was not measured. FPV mode renders the scene twice when another feed interferes. The models are STL (a 3D file format with no compression and no materials), 1.1 MB in total, which is small. | Low | `client/main.js:239` |

### 6. Testing, engineering, deployment, licensing

| # | Finding | Sev. | Evidence |
|---|---|---|---|
| E1 | **No CI** (no `.github/workflows`). CI would mean GitHub runs `npm test` on every push. | Medium | `ls .github` fails |
| E2 | `npm start` runs the Vite **dev** server. The README's "over the internet" recipe very likely hits Vite's host check ("Blocked request. This host is not allowed"), because there is no `vite.config.js` with `server.allowedHosts`. It also needs two tunnels and a hand-typed `?server=wss://…`. | High | `tools/start.mjs:3`, `README.md:60`, `node_modules/vite/dist/node/chunks/node.js:16804-16816` |
| E3 | Tests are plain scripts chained with `&&`, so the first failing file hides the rest. The suite takes 44 s (the bot fight about 25 s). The bot tests are random (see B4), so they can fail now and then. There are no client tests (`client/main.js` has 248 lines of game loop). R1, R2, N3, N4, N5 and N6 have no tests. | Medium | `package.json` scripts |
| E4 | Repo weight: `.git` is 37 MB. `docs/img/*.png` (9.7 MB, about 1 MB each) are re-committed after every screenshot pass, and `papers/` is 13 MB. `papers/venues/` is untracked (new, not in the repo yet). | Low | `du`, `git status` |
| E5 | **Licence wording.** The README says "open source", but PolyForm Noncommercial is not open source in the OSI sense (the Open Source Initiative's definition). `docs/sim-references.md` already says so for PicaSim. Better wording: "source-available, free for hobbyists". The PicaSim Required Notice is present in `NOTICE` and in the file headers (checked: `shared/picasim/aeroplane.js:1-2`). The year "2026" in the notice should be copied exactly from PicaSim's own LICENSE (not checked). The OpenSCAD models are "CC0 proposed", pending Adam's confirmation, so for now they fall under PolyForm. | Medium | `README.md:94`, `NOTICE:5` |
| E6 | Third-party documents in a public repo: the ESA/ACES rule PDFs and the forum pages (`papers/poland/forum_*.html`, `papers/*.pdf`) are redistributed "for reference" without written permission. The risk is low, but the clean options are to ask ACES Polska or to keep only links and the local copies. No e-mail addresses were found in the committed papers (grep). | Low | `git ls-files papers`, `NOTICE` |
| E7 | Trademarks: the banners say "ESASIM", "FLY ESA", "AIR COMBAT", "FOAM · PAPER · FUN". These are generic, with no real brands, and grep found no national insignia on the models. The aircraft type names (Spitfire, Hurricane, …) are used descriptively in a noncommercial game. Low risk. Keep shop links neutral ("no affiliation"). | Low | `client/field.js:76` |

### 7. Product intent (the game is bait)

| # | Finding | Sev. | Evidence |
|---|---|---|---|
| G1 | The only path to the real hobby is the intro card, which is shown once and then removed. The results screen, where a player is most hooked, says nothing about real flying. | High | `index.html:12-27`, `client/hud.js:33` |
| G2 | Issue #1 (worldwide research) is still open. The German EPA rules (rc-aircombat.de), the Czech/Slovak scenes and more videos are unread. | Medium | `docs/fly-for-real.md` "Next" |
| G3 | The workshop does not map to real kits: no "this build = the ef3m Spitfire kit, about X g". A player cannot see what their sim plane would cost or weigh in real life. | Medium | `shared/workshop.js` |
| G4 | Replays are JSON files only. There is no video export, share link or "invite a friend to my room" link. Shared clips spread the game. | Medium | `client/main.js:117-121` |
| G5 | Timing: per `docs/fly-for-real.md`, the 2026 season calendar runs March to September, so the next season is most likely spring 2027 (the 2026 calendar was announced 26.03.2026). Winter is when people play sims. A Polish, deployed, friend-ready build before about February 2027 fits that window. | — | `docs/fly-for-real.md` |

## Development paths

Effort is in vibecoding days (a day of Adam steering an AI), and the estimates are rough. The paths can be combined. Path A's first three steps help every other path.

### Path A: Fair online play ("my friend and I can really fight")

**Goal:** 2-7 people over the internet get fights that feel fair, survive Wi-Fi blips and are hard to cheat in casually.

1. **Single-port deploy** (1 day). The Node server serves the built client (`vite build` → `dist/`) and the WebSocket on one port. Then one tunnel or one small VPS is enough, and no `?server=` is needed. Fix the README. Optional: GitHub Pages for offline practice.
2. **Room codes and a host** (1 day). Private rooms (`?room=ABCD` and a "copy invite link" button). Only the room creator can Start or add bots. Bots count against the 7 slots, and a human who cannot get a slot sees a message instead of becoming a ghost (N6, N7).
3. **Reconnect** (1 day). Use Colyseus `allowReconnection` for about 30 s and key scores by a stable pilot id stored in the browser, not the session id. Show "connection lost" on the client (N5).
4. **Own streamer local, others interpolated** (1-2 days). Draw your own streamer from your own tail. Show remote planes and their streamers about 100 ms in the past with a timestamped buffer (**interpolation**: playing back recent positions smoothly instead of jumping to the newest one), so mesh and ribbon line up (N2).
5. **Lag-compensated cuts** (2-3 days; worth Opus time). The attacker's client detects the cut against what it saw and reports it with a timestamp. The server keeps about 1 s of each streamer's history, rewinds the victim's streamer to that moment, and accepts the cut within a tolerance. This is "favour the shooter", the usual approach in shooter games (N1).
6. **Basic anti-cheat** (1-2 days). Server-side checks of plausible speed and acceleration. Penalise a missing pose as "landed" after 1 s (fixes the alt-tab freeze, N4). The safety line uses the reported position whatever the `airborne` flag says. Ignore `held` while airborne. Validate message shapes (N3, N8). A "contest room" flag that turns off `paramOverrides`.
7. **CI** (0.5 day). A GitHub Action that runs `npm test` with seeded randomness (E1, B4).

**Effort:** about 8-11 days. **Risks:** lag compensation is subtle (it can feel unfair to the victim instead). A VPS costs a few euro a month. Full anti-cheat is impossible while the client flies its own plane; the fix for that is the server simulating every plane, a rewrite. **Adam decides or supplies:** where to host (home PC with a tunnel, or a VPS), whether contest rooms ban the physics editor, and 2-3 friends for a real test evening.

### Path B: Realism ("it flies like my real ESA plane")

**Goal:** sim numbers within about 15 % of a real ESA plane, and keyboard and gamepad flying that a newcomer can survive.

1. **Measure a real plane** (Adam, 1-2 sessions at the field). On the bench: weigh the plane and battery, find the CG (centre of gravity), measure span and wing area, and measure static thrust and watts with a kitchen scale and a wattmeter (a meter between battery and ESC that shows the motor's power), at full throttle. In the air: timed passes between two markers 50 m apart (top speed), a power-off glide from a known height (glide ratio and sink), a slow-motion phone video of full rolls (roll rate), and the stall speed. Even better: a cheap flight controller or GPS logger in the plane.
2. **"Real plane fixture" test** (1 day). Add the measured numbers to `test/picasim.test.js` as targets with tolerances. Tune the drag (prop windmilling, fuselage), thrust and control throws until they pass (P1, P2, P5).
3. **Stick feel** (1 day). Keyboard ramp and expo (a soft curve that keeps small inputs gentle), dual rates, and gamepad presets (Xbox, PlayStation, RadioMaster). Close issue #4 with the real radio (P3, U4).
4. **Bots on the tuned physics** (1-2 days). Retune so the crash rate is at most about 2 per fight. Add a test that fails above that (B1).
5. **Optional:** simple mid-air collisions (bounding spheres, both planes tumble) to enable the cut-plus-collision rule (R6, P4).

**Effort:** 4-6 days of code, plus Adam's field time. **Risks:** measurements in wind are noisy (fly on a calm day and do several passes), and changing the physics will break the bot tuning again. **Adam decides or supplies:** a real plane and measurements, the radio, and whether a "trainer" plane (slower, more stable, not ESA-legal) may exist for beginners.

### Path C: Real-world funnel ("from the game to the field")

**Goal:** every hooked player sees a concrete, Polish-language next step.

1. **Polish UI** (1-2 days). A tiny dictionary file (PL/EN) for the intro, HUD, toasts and workshop. Polish is the default for Polish browsers (U1).
2. **After-fight call to action** (1 day). On the results screen: "Fly this for real: kit about X zł, nearest squadron, next contest", from `docs/fly-for-real.md`, verified links only (G1).
3. **Real-kit presets** (1 day). Workshop presets "ef3m Spitfire as sold" with mass and span taken from the shop pages, plus a link (G3).
4. **Squadrons and contests page** (2 days). A map or list of squadrons and the contest calendar. Only public, permitted information: ask the squadrons first, and no personal data (G2). Do the worldwide pass in the same session (German EPA, Czech/Slovak, US E1000), with each source downloaded per the research rule.
5. **Shareable replays** (2 days). Record a fight as video in the browser (MediaRecorder, the browser's built-in recorder) or upload the replay JSON and get a link. Add "invite a friend" (needs A2) (G4).
6. **Contact the community** (Adam, ongoing). Post on the aircombat.pl ESA forum, ask KG ESA (the class's organisers) about §4.9 (wing/tail tolerance in the air) and permission to host the rule PDFs (E6), and offer the game for contest breaks or winter training.

**Effort:** 6-8 days of code plus Adam's outreach. **Risks:** links rot (check yearly), shops may object to being listed (keep it neutral and remove on request), and personal data in squadron lists. **Adam decides or supplies:** the Polish wording (he is the native speaker), whom to contact, and whether a privacy-friendly click counter is acceptable to measure the funnel.

### Path D: Content and classes ("more to do")

**Goal:** variety, which keeps players coming back.

1. **Rules completeness** (2-3 days). Pilot in zone (§4.6, §4.15, −50) as a "request pickup" key and a judge call, stuck streamers (§4.11), disqualification for the contest (§4.9), one cut per attack across victims (§4.11) (R3-R8).
2. **Bot difficulty levels and tactics** (2 days). Trainer, club and ace levels using reaction delay, aim noise and tactics: defending, chasing the landing bonus, fighting low over the field (B2, B3).
3. **WWI class** (4-6 days). 1000 mm biplanes, 7 min flights, ground launch +10, six ground posts (cutting one = +50, attacks only parallel to the line, §2.2.3), landing bonus +50, ground-launch penalties (§4.4). Needs new models.
4. **Better models** (issue #5). glTF models (a 3D format with materials and textures, unlike STL) from Adam or CC0 sources, with real paint schemes. Check whether national insignia need care for distribution in some countries.
5. **Sound** (1 day). Whistle, motor pitch that follows rpm, a "rip" on a cut (U3).

**Effort:** 10-14 days. **Risks:** this adds features on top of an unfair online core if done before Path A. WWI needs physics tuning without real data. **Adam decides or supplies:** which class comes next, models or plans, and how the judge abstraction should feel ("pilot in zone": a key, or automatic?).

## Fix-now list (small, high value, any path)

These are under a day each: R1 (keep `illegal` across rounds), R2 (send airborne planes home at readiness, or count the first flight-phase second as a launch), N4 (pose timeout), N6 (bots count against `maxClients`, ghost message), E2 (one-port serving or `allowedHosts`, then test the friend recipe for real), E5 (licence wording), and seeding the random numbers in the arena for repeatable tests.

## Recommended order for the next 2 weeks

| Days | What | Why |
|---|---|---|
| 1 | Fix-now list: R1, R2, N4, N6, seeded RNG; tests for each; CI (A7) | Correctness bugs that would embarrass a first public test; CI keeps them fixed |
| 2 | Single-port deploy and a working "play with a friend" (A1), README fixed and tried with one real friend | Nothing else matters if a friend cannot join |
| 3 | Room codes, host-only controls, reconnect (A2, A3) | Makes a real evening of play possible |
| 4-5 | Own streamer local, interpolation buffer (A4) | Visible quality: streamers stop detaching |
| 6-7 | Lag-compensated cuts (A5) with a test that simulates 150 ms of delay. **Use Opus here** | The single biggest fairness problem |
| 8 | Basic anti-cheat and message validation (A6) | Cheap protection once strangers play |
| 9 | Keyboard ramp/expo, gamepad presets (B3) | Newcomers stop snap-rolling into the ground |
| 10 | Polish UI (C1) and the after-fight call to action (C2) | Turns the improved game into bait |
| 11-12 | Adam: field measurements (B1). Code: bot crash rate below 2 per fight (B4), sound (D5) | Real data before the next physics tuning; bots that look competent |
| 13-14 | Buffer, then a playtest evening with 3+ people over the internet; log the findings as issues | Real feedback decides weeks 3-4 (Path B tuning or Path C/D) |

Before starting, Adam needs to decide: (1) where to host (home PC with a tunnel, or a VPS), (2) whether contest rooms disable the physics editor, (3) the licence wording and the CC0 status of the models, and (4) who on the Polish ESA forum to contact, and when.
