# Other RC flight sims: what is available and what to take

Checked 2026-10-04 by cloning the repositories (shallow, kept outside this repo: they are large and differently licensed) and reading the licence files and the flight-model code headers. The licence column is from the repository's own files.

| Sim | Source | Licence (from the repo) | What I read | Useful for ESASIM |
|---|---|---|---|---|
| **PicaSim** (Danny Chapman, slope/glider-oriented, 40+ aircraft) | https://github.com/Rowlhouse/PicaSim | **PolyForm Noncommercial 1.0.0** (`LICENSE.txt`): source-available, noncommercial use allowed, copies must keep the licence/notices. **Not OSI open source.** | `Aerofoil*.h/.cpp`, `AerofoilDefinition.cpp` (`GetFlightData`), file layout of `AeroplanePhysics.cpp` (1537 lines, not read in full) | The modelling approach, see below |
| **CRRCSim** (classic open-source RC sim, based on NASA LaRCsim) | https://github.com/gcmcnutt/CRRCsim (mirror of the SourceForge project) | **GPL-2** (`COPYING`) | Only the file list | Reference for a GPL-compatible port; copying code would make ESASIM GPL |
| **rcsim** (yotamgi, runs in the browser as WASM, helis and planes, RC electronics chain) | https://github.com/yotamgi/rcsim | **No licence file in the repo**, so all rights reserved by default | README and `src/` file list | Ideas only; ask the author before reusing code |
| JSBSim (flight dynamics library), FlightGear | search results only, not cloned | LGPL / GPL per the search summaries, **not verified by me** | nothing | General aircraft sims, heavier than needed |

## What PicaSim does that my flight model does not (verified in `AerofoilDefinition.cpp` and `AerofoilParameters.h`)

My `shared/flight.js` is a single lumped body: lift and drag from one wing, and the stability, control and damping moments are hand-tuned numbers. PicaSim instead models **each aerofoil separately** (wing panels, tailplane, fin), each with:

- an offset and extents (area, aspect ratio, span efficiency) so pitch/yaw/roll stability, damping and coupling **come out of the geometry** instead of being tuned;
- a CL(angle of attack) curve with a smooth blend into a stalled flat-plate-like branch, and a stalled drag that depends on aspect ratio (my model uses a simplified version of the same ideas);
- **Reynolds-number drag scaling** (important for 0.8 m foam planes flying slowly);
- **control effectiveness that halves at a given speed** (`mControlHalfSpeed`), so elevators and ailerons go mushy at low speed;
- **prop wash** over the wing and tail, **shadowing** of the fin by the tailplane, **ground effect**, and a turbulence input.

## Update: what was done with this (same day)

The physics was ported: see [`physics.md`](physics.md). PicaSim's README says its **images and models need the authors' permission for use in other projects** (only its text and XML data, which includes the aeroplane and aerofoil parameters, are under the PolyForm licence), so its textures are not used. ESASIM uses CC0 textures from Poly Haven instead (the same site PicaSim's own sky came from): see `NOTICE`. If you want PicaSim's own panoramas or skies, ask Danny Chapman (the address is in PicaSim's README).

## Original suggestion (done)

A "flight model v2": split the plane into wing halves, tailplane and fin using the surface geometry we already have in `models/scad/esa_plane.scad`, compute blade-element forces per surface with the effects above, and keep the current model as the baseline in the tests (same hand-launch, stall, roll-rate checks). The idea is not copyrightable, so it can be written from scratch; **do not copy PicaSim code** unless ESASIM is released under a noncommercial licence too (Adam to decide the repo licence; none is set yet).
