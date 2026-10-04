// Crepe-paper streamer, ESA §3.7: 10 m x 1 cm, 20-30 cm marked "ochrona" end.
// Simplest model (Adam's decision): it follows the recorded trace of the plane's tail, plus a wobble
// that grows toward the free end (turbulence). Everything is deterministic given (trace, time, seed),
// so the server can compute cuts and clients can draw the same polyline.
import { FIGHT } from "./rules.js";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export class Streamer {
  constructor({ length = FIGHT.streamerLength, spacing = 0.5, wobble = 0.12, seed = 0 } = {}) {
    this.nominal = length;       // §3.7
    this.length = length;        // current attached length; a cut shortens it (§4.11)
    this.spacing = spacing;
    this.wobble = wobble;        // DESIGN: wobble amplitude at the free end, metres
    this.phase = seed * 1.7;
    this.head = null;
    this.trace = [];             // older tail positions, oldest first
    this.gen = 0;                // which streamer this is: +1 on every reset, so a rewound (lag-compensated) copy never mixes an old streamer with a new one
  }

  get intact() { return this.length >= this.nominal - 1e-6; }   // §4.10: shortened = lost

  reset(tail) {                                                 // new streamer attached on the ground (§4.4)
    this.length = this.nominal; this.head = tail ? [...tail] : null; this.trace = []; this.gen++;
  }

  // Call every frame with the current tail position.
  push(tail) {
    if (!this.head) { this.head = [...tail]; return; }
    if (len(sub(tail, this.head)) > 0.04) {
      this.trace.push(this.head);
      this.head = [...tail];
      let arc = 0;                                              // drop points beyond the streamer length (+1 m margin)
      for (let i = this.trace.length - 1; i > 0; i--) {
        arc += len(sub(this.trace[i], this.trace[i - 1]));
        if (arc > this.nominal + 1) { this.trace.splice(0, i - 1); break; }
      }
    } else this.head = [...tail];
  }

  // Polyline from the tail to the free end, sampled every `spacing` metres, at time t (seconds).
  points(t = 0) {
    if (!this.head) return [];
    const path = [this.head];
    for (let i = this.trace.length - 1; i >= 0; i--) path.push(this.trace[i]);
    const out = [];
    let seg = 0, segStart = 0, segLen = path.length > 1 ? len(sub(path[1], path[0])) : 0;
    const L = this.length;
    for (let s = 0; s <= L + 1e-9; s += this.spacing) {
      while (seg < path.length - 1 && s > segStart + segLen) { segStart += segLen; seg++; segLen = seg < path.length - 1 ? len(sub(path[seg + 1], path[seg])) : 0; }
      let p, d;
      if (seg < path.length - 1) {
        const a = path[seg], b = path[seg + 1], u = segLen > 0 ? (s - segStart) / segLen : 0;
        p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        d = norm(sub(a, b));
      } else {                                                  // trace shorter than the streamer: it hangs/lies behind
        const e = path[path.length - 1], r = s - segStart;
        const y = Math.max(0.02, e[1] - r);
        p = [e[0], y, e[2] - Math.max(0, r - (e[1] - 0.02))]; d = [0, -1, 0];
      }
      const k = s / L;
      const amp = this.wobble * Math.pow(k, 1.5);
      if (amp > 0) {                                            // turbulence wobble, grows toward the free end
        let lat = cross(d, [0, 1, 0]); if (len(lat) < 1e-3) lat = [1, 0, 0]; lat = norm(lat);
        const vert = cross(d, lat);
        const a1 = Math.sin(2 * Math.PI * 1.2 * t - 2.0 * s + this.phase);
        const a2 = 0.6 * Math.sin(2 * Math.PI * 1.7 * t - 1.5 * s + this.phase * 1.3);
        p = [p[0] + (lat[0] * a1 + vert[0] * a2) * amp, p[1] + (lat[1] * a1 + vert[1] * a2) * amp, p[2] + (lat[2] * a1 + vert[2] * a2) * amp];
        p[1] = Math.max(0.02, p[1]);
      }
      out.push(p);
    }
    return out;
  }

  // Cut at arc distance s from the tail: the cut-off piece no longer counts (§4.11, only attached streamers count).
  cut(s) { this.length = Math.min(this.length, Math.max(0, s)); }
}
