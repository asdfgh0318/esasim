# Plane models: what to look for

## What the rules allow (ACES WWII 2023, §3.1, §3.4 E)

- Warbird built 1935-1945, original engine ≥ 500 hp, scale 1:12; span and fuselage length within ±5 %, other dimensions within ±2 cm.
- Wing thickness ≥ 10 %. Multi-engine models need the same number of engines as the original.
- Electric limits by class (.10 / .15 / .21 / .25), weight 500-1500 g (multi-engine up to 1700 / 1800 g); see `rules.md`.
- So any single-engine WWII fighter at 1:12 fits: Spitfire, Bf 109, FW 190, Mustang, Zero, Hellcat, Corsair, Fiat G.55, Yak-3 and so on. Bombers and twins are legal but harder.

## What the sim needs per plane

1. **A 3D model**: glTF/GLB, low-poly (under about 50k triangles, under 5 MB), nose along +Z, y up, 1 unit = 1 m ideally (or we scale to 1:12 span). Own work or a licence that allows redistribution in a public repo (CC0 or CC-BY with credit).
2. **A parameter file** like `shared/planes/fw190d.js`: mass, span, wing area, prop size and pitch, rpm limit, thrust estimate. Sources: the plan or manual of a real 1:12 model, plus our flight tuning.
3. **A plan or 3-view drawing** (≥ 1:72, §3.1) to check the ±5 % / ±2 cm scale rules in the workshop later.

## Real ACES designs already in the repo

From aircombat.eu "Building plans" (free for private use, Creative Commons BY-NC-SA per that page); unmodified zips in `models/plans/`:
- **FW-190D Dora**, Leonhard Grugl: span 875 mm, length 850 mm, 820 g, 9x4.7 prop, 3S 2200 mAh. Used for the first flight parameters. Its zip is donationware: pass it on unmodified with its text file.
- **Fiat G.55 Centauro**, Uwe Limberg: DXF cut files and a PDF plan. Not read yet.

## Where to look for 3D models (not checked yet)

Candidates only, nothing here is verified: Sketchfab with the CC filter and glTF download, Poly Pizza, CC0 packs, or Adam's own models. Check the licence of every model before it goes in the repo. Adam said he will look for models, so this stays a to-do until he sends some.
