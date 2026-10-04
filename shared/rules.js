// ESA (Electric Simple Aircombat) WWII-class constants.
// Source: papers/poland/Regulamin_Aircombat_ESA_2024.pdf (ESA 2024 rules). Every value cites its §.
// DESIGN = the rules are silent, our choice, listed in docs/rules.md "Open points".
// Axes: x across the field, z away from the pilots (flight zone is z > 0), y up. z = 0 is the safety line.
export const FIELD = {
  safetyLineZ: 0,                    // §2.1: safety line 0 m
  pilotLineZ: -3,                    // §2.2.4: 3 m behind the safety line
  readinessGap: 6.5,                 // §2.2.5: readiness line 5-8 m behind the pilot line (middle value; §2.1 list is ambiguous)
  audienceZ: -13,                    // §2.3: at least 10 m behind the safety line; §2.1 says 10-15 m
  landingField: { w: 50, d: 20 },    // §2.2.2: 50 m long, 20 m deep from the safety line, inside the flight zone
  pitCount: 7,                       // §4.1: up to 7 pilots
  pitSpacing: 4,                     // §2.2.5: 3-5 m between pilots (middle value)
  flightZone: { w: 100, d: 80 },     // DESIGN: §2.2.1 leaves the size to the organiser (§2 recommends a site >= 100 x 50 m)
};
export const SCORING = {
  flightSecondsPerPoint: 3,          // §6
  flightPointsMax: 100,              // §6: full flight time, WWII
  cut: 100,                          // §6, §4.11
  streamerProtected: 50,             // §6, §4.10 (needs >= 10 s airborne)
  landingAfterEnd: 20,               // §6: WWII
  landingMinSecondsBeforeEnd: 10,    // §4.7: last launch at least 10 s before the end signal
  safetyLine: -200,                  // §6, §4.9 (second crossing = land, disqualified)
  nonEngagement: -50,                // §6, §4.14
  zoneWithoutPermission: -50,        // §6
};
export const FIGHT = {
  minPilots: 2, maxPilots: 7,        // §4.1
  prepSeconds: 5 * 60,               // §4.2.1: "zaleca się pięć minut"
  flightSeconds: 5 * 60,             // §4.5: WWII 5 minutes
  nonEngagementSeconds: 30,          // §4.14
  streamerLength: 10, streamerWidth: 0.01, // §3.7
  streamerProtectionLength: 0.25,    // §3.7: 20-30 cm marked end
};
export const PLANE_LIMITS = {        // §3.1.2, §3.4, §3.6.2: WWII single-engine
  spanMm: [700, 860], massG: [200, 450], batteryWh: 15,
};
export const pitX = (i) => (i - (FIGHT.maxPilots - 1) / 2) * FIELD.pitSpacing; // start boxes along the pilot line
