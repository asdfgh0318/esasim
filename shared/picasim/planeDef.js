// One entry point for "which aeroplane definition does this build make": the ESA-style warbirds (esaDef.js) or the PicaSim Electric Kato (katoDef.js).
import { buildEsaDef } from "./esaDef.js";
import { buildKatoDef } from "./katoDef.js";

export const buildPlaneDef = (b) => (b && b.plane === "kato" ? buildKatoDef(b) : buildEsaDef(b));
