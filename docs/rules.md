# ESA (Electric Simple Aircombat) rules: extract for the sim

**Source of truth: `../papers/poland/Regulamin_Aircombat_ESA_2024.pdf`** ("Regulamin zawodów i klas modeli latających ESA (Electric Simple Aircombat)", 7 pp, "obowiązuje od sezonu 2024"). Where this file and the PDF disagree, the PDF governs. Polish quotes are verbatim; English is my translation.

**Version.** The ACES Polska forum thread lists this 2024 document as the one for "2024 i 2025" (posted 15.08.2024). The official 2026 announcement (Rozkaz KG ESA #2026/03, 26.03.2026, `papers/poland/forum_esa_t234_puchar_kalendarz_2026.html`) says: "Obowiązujący regulamin: zgodnie z viewtopic.php?f=11&t=21 [bez zmian względem poprzedniego sezonu]", i.e. the rules in that thread are unchanged for 2026. So the 2024 PDF is current as far as I can verify.

Read in full: 2024 rules (text + page 1 image checked). Downloaded, only skimmed for differences: the 2022 rules (`Regulamin_Aircombat_ESA_2022.pdf`). The 2022 forum thread notes a landing-points change for WWI (WWII stayed +20).
Fallback: §1.2 "Wszelkie zasady nie ujęte w tym regulaminie reguluje regulamin Aircombat ACES wraz z załącznikami." The ACES extract is in [`rules-aces.md`](rules-aces.md).
Classes: ESA WWI (biplane-era, 1000 mm span, ground targets) and ESA WWII. **The sim starts with WWII**, single-engine.

## Field (§2)

| Item | Rule | Cite |
|---|---|---|
| Site | "Zaleca się aby teren ... był nie mniejszy niż 100 x 50 m" and free of trees/buildings "na odległość większą niż 100m" (recommendation) | §2 |
| Zone layout | safety line 0 m, pilot line 3 m, readiness line 5-8 m, spectators 10-15 m (schematic is a text list, no drawing) | §2.1 |
| Flight zone | "zawsze przed linią bezpieczeństwa"; size set by the organiser | §2.2.1 |
| Landing field | "Prostokątny obszar o długość 50m i szerokości 20m (licząc od linii bezpieczeństwa) w strefie lotów" | §2.2.2 |
| Safety line | "równolegle do linii pilotów w odległości 3 metrów"; in the air a half-plane perpendicular to the field | §2.2.4, §2.1 |
| Start boxes | "3-5 metrów między pilotami"; readiness line "5-8 metrów" from the pilot line | §2.2.5 |
| Audience | "przynajmniej 10m za linią bezpieczeństwa" or behind a net | §2.3 |
| WWI ground targets | 6 foam posts 3x3x100 cm (not used in WWII) | §2.2.3 |

Ambiguity: the §2.1 list reads as distances from the safety line, while §2.2.5 gives the readiness line "5-8 m" from the pilot line. The sim uses the §2.2.5 text (6.5 m behind the pilot line). Flight-zone size is not specified: design choice.

## Planes, WWII class (§3)

| Item | Rule | Cite |
|---|---|---|
| Type | "półmakieta rzeczywistego samolotu wojskowego wyprodukowanego w latach 1935 – 1945"; 3-view drawing ≥ 1:72 at the contest | §3.1.2 |
| Wingspan | single-engine **700-860 mm**, multi-engine 860-1000 mm; other dimensions within ±3 cm of scale | §3.1.2 |
| Mass | single-engine **min 200 g, max 450 g**; multi-engine max 600 g | §3.6.2 |
| Battery | single-engine **max 15 Wh** (nominal V·mAh/1000), multi-engine 28 Wh; at least 2 batteries per pilot | §3.4 |
| Material | foam only (EPP, styrofoam, styrodur, depron); no hard reinforcement of leading/trailing edges; first spar 10 mm behind the leading edge; no protrusions ahead of the leading edge | §3.1 |
| Motor / prop | any electric motor; any factory prop; shaft must not protrude past the prop (prop saver or spinner) | §3.2, §3.5 |
| Battery disconnect | quick, tool-free | §3.3 |
| Streamer | crepe paper, **length 10 m, width 1 cm**, "ochrona" marked 20-30 cm at the end | §3.7 |
| Helmet | required for everyone in front of the audience line | §3.8 |

There is no stabilisation clause in ESA; ACES §3.9 (no electronic stabilisation) applies by the fallback rule. The sim flies unstabilised.

## Fight (§4)

- 2 to 7 pilots, everyone against everyone; a round = one fight per pilot; 3 rounds recommended; final with the top 7. (§4.1)
- Preparation (organiser decides, "zaleca się pięć minut"), then readiness, then flight; one long signal starts and ends the flight part. (§4.2)
- **Maximum flight time: WWII 5 minutes.** (§4.5)
- **WWII takes off by hand**: "Start z ręki jest dozwolony w obszarze między linią pilotów i linią bezpieczeństwa a start z ziemi modeli w klasie WWI tylko poza linią bezpieczeństwa." A helper may throw the model. Pilot steps back to the pilot line after launch. (§4.4)
- Streamer missing or shorter than required at launch: land at once and attach a new one. (§4.4)
- Unlimited restarts; fetching a model from the flight zone needs the judge's permission ("pilot w strefie"); restart from the first launch place with the complete model. (§4.6, §4.15)
- Landing bonus after the end signal only if the last launch was at least 10 s before the end signal. (§4.7)
- One model per fight. (§4.8)
- Safety line crossing: first = penalty points; second = penalty, must land at once, flight time stops, disqualified but keeps points. In the air the whole model must be clearly beyond the line; on the ground the motor counts; wing or tail over the line with the motor on the field side is not a crossing. (§4.9)
- Streamer lost/shortened after landing = lost (no protection points); intact-streamer bonus needs ≥ 10 s in the air. (§4.10)
- Cut: attacker gets 100 points. A stuck enemy streamer counts as a normal cut and losing it does not cost protection points. Only streamers attached to a model count (not falling ones). Several cuts in one attack = one cut. A cut plus a collision-kill in the same attack counts only if the cutting plane can keep flying; a falling or gliding model scores no cut unless the streamer wrapped into the motor (judge confirms). (§4.11)
- Cut streamers must not be removed; the pilot may slide them toward the fuselage. (§4.12)
- Collisions: no penalty for collisions or losing the model; flight time is measured until the fuselage hits the ground. (§4.13)
- Non-engagement: more than 30 s away from the fight gets a warning, 30 s more gets the penalty. (§4.14)
- Tie-break: points in the final, then best single fight. (§4.16)
- Protests: decided by a vote of the contestants, simple majority; fee of twice the start fee. (§4.19)

## Scoring (§6), WWII column

| Event | Points |
|---|---|
| Flight time up to 300 s | +1 per 3 s |
| Flight time after 300 s | +2 per 3 s (irrelevant for WWII, max flight is 300 s) |
| Full flight time points | **WWII: 100** (WWI: 180) |
| Cut enemy streamer | +100 |
| Own streamer protected | +50 |
| Landing in the landing field after the end signal | **WWII +20** (WWI +50) |
| Crossing the safety line | −200 |
| Non-engagement | −50 |
| Entering the flight zone without permission; low pass or ground attack during "pilot w strefie" | −50 each |
| Overweight model, battery over limit | 0 points for the round |

(Source: §6. The table lists the landing bonus twice in the PDF; WWII is +20 in both places. The forum thread discusses a typo/vote about it; WWII stayed +20 in 2022.)

## Mapping to the sim (draft)

| Rule | Sim idea |
|---|---|
| 10 m streamer, 1 cm | Trailing chain; cut = segment crosses the enemy prop disc (Adam's decision) |
| Safety line half-plane | Server check, plane position beyond z = 0 toward pilots; second crossing = disqualified |
| Hand launch | Plane is held at the pit, launched with a throw (Space) |
| 5 min flight, 100 points full | Server timer, 1 point per 3 s |
| Landing bonus +20 | Land in the 50 x 20 m field after the end signal, last launch ≥ 10 s before the signal |
| Mass ≤ 450 g, ≤ 15 Wh, span 700-860 mm | Workshop validation (later) |
| Foam only, soft leading edge | Workshop rule; affects durability model if any |

## Open points

- Flight-zone size and start-box size are not given: design values in `shared/rules.js`.
- Check what ACES appendices (model measurement, points table) still apply to ESA.
- WWI class rules (ground posts, ground launch, 1000 mm span) later.
