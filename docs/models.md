# Plane models: what to look for (ESA WWII class)

## What the rules allow (ESA 2024 §3.1.2, §3.1, §3.4, §3.6.2)

- A "półmakieta" (semi-scale) of a real military aircraft built 1935-1945; 3-view drawing ≥ 1:72 at the contest.
- Single-engine: **span 700-860 mm, mass 200-450 g, battery max 15 Wh**. Multi-engine: span 860-1000 mm, max 600 g, 28 Wh.
- **Foam only** (EPP, styrofoam, styrodur, depron). No hard reinforcement (carbon, glass, wood) of leading or trailing edges; the first spar must sit 10 mm behind the leading edge. Nothing protruding ahead of the leading edge. Sandpaper strips ("karabiny") on the leading edge are allowed.
- Any electric motor, any factory prop, shaft must not stick out past the prop (prop saver or spinner).
- So any WWII fighter at 700-860 mm span in foam fits: Spitfire, Bf 109, FW 190, Mustang, Zero, Yak-3 and so on.

## What the sim needs per plane

1. **A 3D model**: glTF/GLB, low-poly (under about 50k triangles, under 5 MB), nose along +Z, y up, 1 unit = 1 m (span 0.70-0.86 m). Own work, or a licence that allows redistribution in a public repo (CC0 or CC-BY with credit).
2. **A parameter file** like `shared/planes/esa-wwii.js`: mass, span, wing area, prop, thrust. Rule limits are checked; the rest are estimates until tuned.
3. **A 3-view drawing** (≥ 1:72) to check "±3 cm of scale" (§3.1.2) in a later workshop.

## Plans in the repo (ACES, not ESA-legal)

From aircombat.eu "Building plans" (Creative Commons BY-NC-SA per that page), unmodified zips in `models/plans/`: **FW-190D Dora** (Leonhard Grugl: 875 mm, 820 g, EPS foam, donationware, pass on unmodified) and **Fiat G.55** (Uwe Limberg). **Both are ACES-class: the FW-190D at 820 g and 875 mm is above the ESA limits (450 g, 860 mm).** Kept only as reference. ESA-class plans still have to be found (see issue #1).

## Where to look for 3D models (not checked yet)

Candidates only, nothing verified: Sketchfab with the CC filter and glTF download, Poly Pizza, CC0 packs, or Adam's own models. Check each licence before it goes into the repo. Adam said he will look for models.
