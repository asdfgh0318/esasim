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

## Models in the repo (OpenSCAD, original work)

No suitable free model was found, so four ESA-style planes are built in **OpenSCAD**: `models/scad/esa_plane.scad` (Spitfire, Hurricane, FW 190, Yak-3; all four have ESA kits at ef3m.pl). `tools/build-models.sh` exports each part to `public/models/<plane>/<part>.stl` (fuselage, wing, tail, canopy, spinner, prop; about 1 MB in total, needs `openscad`), and `client/planeModel.js` loads them with Three.js's STLLoader. `viewer.html?plane=all&view=iso` shows them (dev tool).

![The four modelled planes](img/models.png)

- **Dimensions:** span 800 mm, length 600 mm, 60 mm wing dihedral, flat EPP-style tail plates, 9 inch two-blade prop. These follow the Hurricane ESA kit page and the Spitfire kit build guide (saved locally in `papers/poland/`: 800 mm span, about 600 mm long, 200-350 g, 9x5 or 8x4 prop; dihedral 60 mm at the tip). The outlines are **stylised, not scale drawings**; they differ in nose length, cowl, canopy, tail and wing planform (elliptical Spitfire, tapered others).
- **Per-plane physics:** wing area follows each planform (`shared/planes/index.js`); mass, power and the rest are shared DESIGN values.
- **Licence:** the SCAD files and STLs are original work; I'd release them as CC0 (Adam to confirm).
- **Free models checked first:** Poly Pizza (CC BY 3.0) only has generic cartoon planes and a WWI DH2, no WWII fighter. Sketchfab has CC BY low-poly Spitfires and Bf 109s, but downloads need a login, so I could not fetch or verify them. Kenney has no aircraft pack that I could find.
- **Real models are still welcome:** drop a glTF/STL in and add a params entry; see below.

## Plans in the repo (ACES, not ESA-legal)

From aircombat.eu "Building plans" (Creative Commons BY-NC-SA per that page), unmodified zips in `models/plans/`: **FW-190D Dora** (Leonhard Grugl: 875 mm, 820 g, EPS foam, donationware, pass on unmodified) and **Fiat G.55** (Uwe Limberg). **Both are ACES-class: the FW-190D at 820 g and 875 mm is above the ESA limits (450 g, 860 mm).** Kept only as reference. ESA-class plans still have to be found (see issue #1).

## If you find a better model

Sketchfab CC BY models (low-poly Spitfire, Bf 109 and others exist, login needed to download) are the likeliest source; check the licence on each page and credit the author. A new model needs: glTF/GLB or STL, nose along +Z, y up, scaled to an 0.8 m span, an entry in `PLANE_TYPES` and `shared/planes/index.js`.
