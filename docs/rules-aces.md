# ACES R/C Air Combat rules: extract (FALLBACK reference, not the primary rules)

> **Correction 2026-10-04:** the competition is **ESA (Electric Simple Aircombat)**, a Polish class. Its regulations are in [`rules.md`](rules.md) and govern. ESA §1.2 says: "Wszelkie zasady nie ujęte w tym regulaminie reguluje regulamin Aircombat ACES wraz z załącznikami" (anything not in the ESA rules is governed by the ACES rules and appendices), so this ACES extract only fills gaps. Many ACES values differ from ESA (1:12 scale, 500-1500 g, 12 m streamer, 7 min flight) and must NOT be used for ESA.

**Source of truth: the PDFs in `../papers/`. Where this file and a PDF disagree, the PDF governs.**

Read in full (text extracted with `pdftotext`, page images checked for Fig. 1):

| File | What | Read |
|---|---|---|
| `2023_ACES_int_WWII Rules.pdf` | International WWII rules 2023, 8 pp (**primary**) | yes |
| `2016_ACES_int_WWII_Appendix_3-1_model_measurments.pdf` | Model measuring method, 4 pp | yes |
| `2016_ACES_int Sek-point table Apendix 4-5.pdf` | Points table, 1 p | yes |
| `2016_ACES_int_WWII Rules.pdf`, `2016_ACES-int_WWI_Rules.pdf` | Older WWII and WWI rules | downloaded, **not yet read**; WWI is a later class |

Also downloaded to `papers/` but not read: 2019 ACES-D EPA (49 pp, German, a different class), 2023 and 2016 ACES-D WWII (German), 2016 ACES-D WWI, 2011 WWII regulations. Not fetched: `2016 ACES Regulations WWI WWII History.zip`.
The Appendix 3.1 header says "ACES Rules 2009-2010" (version 2008-12-07), and the 2023 rules cite it. Its figures are a 2008 snapshot.

## Field (§2, Fig. 1 on p. 1)

| Item | Rule | Cite |
|---|---|---|
| Landing field | Fig. 1: "landingfield 20 x 75 m" | p.1 Fig 1 |
| Safety line | "runs parallel to and is situated 5 – 10 meters in front of the pilot line" | §2.2.3, p.2 |
| Start pits | "Startpits 3x 3 m"; 7 pits numbered 1-7 on the pilot line; "distance of 3 – 5 meters spacing between pilots" | Fig 1; §2.3 |
| Readiness line | "10 m" behind the start pits | Fig 1; §2.3 |
| Preparation zone | 10-20 m behind the readiness line; contest tent with speaker | Fig 1 |
| Safety fence | 10-20 m behind the prep zone; spectators without helmets beyond | Fig 1 |
| Helmet zone | "with helmet only area", 40-60 m from the safety line to the fence | Fig 1; §2.4 |
| Flight area | "always in front of the safety line". **No width or depth is given** in the rules. | §2.2.1 |

The 20 x 75 m figure is the landing field, not the whole flight area. The flight-area size is an open design choice.

## Models (§3)

- Warbird "built between 1935 and 1945", original engine ≥ 500 hp. Scale **1:12**; span and fuselage length ±5 %; other dimensions ±2 cm. Wing thickness ≥ 10 %. (§3.1)
- Streamer catchers on the wing: max 297 mm from fuselage side. (§3.1)
- Electric setups: min flight time 450 s at full throttle; energy limit per class; **PSS = max rpm × prop pitch (in) ≤ 72 000**. (§3.4 E)

| E class | max Wh | max prop Ø | PSS | min weight | max weight |
|---|---|---|---|---|---|
| .10 | 30 | 9" | 72 000 | 500 g | 1500 g |
| .15 | 40 | 9" | 72 000 | 700 g | 1500 g |
| .21 | 50 | 10" | 72 000 | 900 g | 1500 g |
| .25 | 67 | 11" | 72 000 | 1100 g | 1500 g |
| .25 ducted fan | n/a | n/a | n/a | 700 g | 1500 g |
| Multi-engine, original span < 16 m | setup limits above | | | 1200 g | 1700 g |
| Multi-engine, original span ≥ 16 m | setup limits above | | | 1200 g | 1800 g |

- IC classes have their own table (rpm, propsum, dry/max weight); see §3.4 in the PDF. The sim will start with the electric table.
- "Any electronic flight stabilization systems are not allowed." (§3.9)
- Streamer: "12 +/- 0,5 meters long one piece. It shall be 10-15mm wide." (§3.6)

## Contest and scoring (§4, §6)

- A fight has 2 to 7 pilots; a round is one fight per pilot; recommended 3 rounds, then a final with the top 7. (§4.1)
- Phases: preparation (recommended 7 min), readiness, flight. Whistle signals mark the changes. (§4.2)
- "Maximum flight-time is seven minutes. One point per three seconds airborne ... up to a maximum score of 138 (6:54 min)". (§4.5)
- Unlimited restarts, only if the model lands in the landing zone, from the same start pit, with the judge's permission. (§4.6)
- The same aircraft for the whole fight. (§4.7)
- Take-off only between pilot line and safety line; no point counts if the streamer is not intact at take-off. (§4.4)

| Event | Points | Cite |
|---|---|---|
| Crossing safety line (first) | −200, flight time stopped, must land; **second crossing = disqualified** | §4.9, §6.1 |
| Non-engagement (>30 s away, warned, +30 s more) | −50 | §4.13 |
| Engine over rpm limit by ≥100 rpm | −50 | §3.4.2 |
| Own streamer uncut at end | +50 (needs ≥10 s airborne) | §4.10 |
| Cut enemy streamer | +100 | §4.11 |
| Flight time | +1 per 3 s, max +138 | §4.5 |

Cut and collision details:
- Several cuts during one fly-by count as one cut. A cut together with a kill in one fly-by does not count. (§4.11)
- Midair collision: "No kill points or consolation points will be given." The survivor may keep flying for flight points. Flight time stops when the fuselage hits the ground. (§4.12)
- Tie-break: highest points in the final, then the best single fight. (§4.14)

## Mapping to the sim (draft)

| Rule | Sim implementation idea |
|---|---|
| Streamer 12 m | Trailing chain of verlet points, cut test against enemy propeller or wing swept volume |
| Safety line | Server-side plane check: crossing = −200, forced landing, second = out |
| Flight-time points | Server timer from take-off, 1 point per 3 s, capped |
| 7 pilots per fight | Room maxClients = 7 |
| Prep/readiness/flight | Room state machine with the 7 min / readiness / flight phases |
| PSS, Wh, weight limits | Validation in the workshop (plane builder) |
| No stabilisation | No auto-leveling in the flight model |

## Open points for later

- Flight area dimensions (not in the rules).
- How to detect a "cut" physically: needs a design decision.
- Scale-fidelity checks (±5 % / ±2 cm) in the workshop; needs 3-view drawings.
- Read the 2016 WWII and WWI rules and the IC tables if those classes are wanted.
