// The four ESA-style planes modelled in models/scad/esa_plane.scad. Same powertrain and mass (DESIGN, kit 200-350 g),
// wing area from each planform [scad]: elliptical Spitfire 0.103 m2 (800 * (52 + 98 * pi / 4) mm2), Hurricane mean chord 125 mm,
// FW 190 mean chord 119 mm, Yak-3 mean chord 112 mm, all over a 0.8 m span.
import { ESA_WWII } from "./esa-wwii.js";

const wingArea = { spitfire: 0.103, hurricane: 0.100, fw190: 0.095, yak3: 0.0895 };
export const PLANES = Object.fromEntries(Object.entries(wingArea).map(([id, a]) => [id, { ...ESA_WWII, id, wingArea: a }]));
export const PLANE_IDS = Object.keys(PLANES);
export const planeParams = (id) => PLANES[id] || ESA_WWII;
