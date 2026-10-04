// Plane factory: the PicaSim-derived physics (shared/picasim/) when the params carry an aeroplane definition, else the old
// lumped model (shared/flight.js, kept as a fallback). Both expose the same interface.
import { Plane } from "./flight.js";
import { PicaPlane } from "./picasim/plane.js";

export function createPlane(params) { return params.def ? new PicaPlane(params) : new Plane(params); }
