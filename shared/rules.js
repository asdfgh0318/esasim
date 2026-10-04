// ACES WWII Rules 2023 constants. Every value cites its § in papers/2023_ACES_int_WWII Rules.pdf.
// Where the rules are silent the value is marked DESIGN and listed in docs/rules.md "Open points".
export const FIELD = {
  landingField: { w: 75, d: 20 },   // Fig 1 "landingfield 20 x 75 m"
  safetyLineGap: 7.5,               // §2.2.3: 5-10 m in front of the pilot line (middle value chosen)
  startPit: 3,                      // Fig 1: pits 3 x 3 m
  pitCount: 7,                      // Fig 1 / §4.1: up to 7 pilots per fight
  pitSpacing: 4,                    // §2.3: 3-5 m between pilots (middle value chosen)
  readinessGap: 10,                 // Fig 1 / §2.3: 10 m behind the pits
  flightArea: { w: 150, d: 100 },   // DESIGN: rules give no flight-area size
};
export const SCORING = {
  safetyLine: -200,                 // §4.9, §6.1 (second crossing = disqualified)
  nonEngagement: -50,               // §4.13, §6.1
  streamerIntact: 50,               // §4.10, §6.1 (needs >=10 s airborne)
  streamerCut: 100,                 // §4.11, §6.1
  flightSecondsPerPoint: 3,         // §4.5
  flightPointsMax: 138,             // §4.5 (6:54 min)
};
export const FIGHT = {
  maxPilots: 7,                     // §4.1 (min 2)
  minPilots: 2,
  prepSeconds: 7 * 60,              // §4.2.1 recommended
  flightSeconds: 7 * 60,            // §4.5 maximum flight time
  streamerLength: 12,               // §3.6
  nonEngagementSeconds: 30,         // §4.13
};
