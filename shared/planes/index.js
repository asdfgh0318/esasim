// The four ESA-style planes modelled in models/scad/esa_plane.scad. Same powertrain and mass (DESIGN, kit 200-350 g),
// wing area from each planform [scad]: elliptical Spitfire 0.103 m2 (800 * (52 + 98 * pi / 4) mm2), Hurricane mean chord 125 mm,
// FW 190 mean chord 119 mm, Yak-3 mean chord 112 mm, all over a 0.8 m span.
// Plus the PicaSim Electric Kato flying wing (shared/picasim/katoDef.js), a practice plane that is not an ESA WWII warbird.
import { ESA_WWII } from "./esa-wwii.js";
import { buildEsaDef } from "../picasim/esaDef.js";
import { buildKatoDef, KATO_SPAN_MM } from "../picasim/katoDef.js";

const wingArea = { spitfire: 0.103, hurricane: 0.100, fw190: 0.095, yak3: 0.0895 };
const KS = 800 / KATO_SPAN_MM;     // the Kato at the workshop's default span of 800 mm (scale 0.66 of PicaSim's 1.21 m)
export const PLANES = {
  ...Object.fromEntries(Object.entries(wingArea).map(([id, a]) => [id, { ...ESA_WWII, id, wingArea: a, def: buildEsaDef({ plane: id }) }])),
  // Geometry along +z from the CG-free def origin, metres, native size x scale: pusher prop disc at -0.125, mean leading edge about 0, streamer at the trailing edge, wing area 0.32 m2.
  kato: { ...ESA_WWII, id: "kato", name: "Electric Kato (PicaSim flying wing)", def: buildKatoDef({ spanMm: 800 }), span: 0.8, wingArea: 0.32 * KS * KS,
    noseZ: -0.125 * KS, wingLeZ: 0.0, tailZ: -0.22 * KS, propDiaIn: 0.16 * KS / 0.0254, propPitchIn: 0.18 * KS / 0.0254 },
};
export const PLANE_IDS = Object.keys(PLANES);
export const BOT_PLANE_IDS = PLANE_IDS.filter((id) => id !== "kato");   // the bot pilot is tuned for conventional planes, not for the flying wing
export const planeParams = (id) => PLANES[id] || ESA_WWII;
