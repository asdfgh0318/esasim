// Run: node test/cut.test.js
import { Streamer } from "../shared/streamer.js";
import { findCut } from "../shared/cut.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";

let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
const geom = { noseZ: ESA_WWII.noseZ, wingLeZ: ESA_WWII.wingLeZ, span: ESA_WWII.span, propRadius: ESA_WWII.propDiaIn * 0.0254 / 2 };

// Enemy flies along +z at 15 m/s, y = 5; its streamer trails behind.
function enemy(seconds, dt = 0.05) {
  const st = new Streamer({ seed: 1 });
  let z = 0, t = 0;
  st.reset([0, 5, z]);
  for (; t < seconds; t += dt) { z += 15 * dt; st.push([0, 5, z - 0.36]); }
  return { st, t, z };
}
const pose = (x, y, z, fx, fy, fz) => ({ pos: [x, y, z], fwd: [fx, fy, fz], right: [fz, 0, -fx] });

let { st, t, z } = enemy(3);
const poly = st.points(t);
check("streamer length", Math.abs(poly.length - 1 - 10 / 0.5) <= 1, `${poly.length} points, ${st.length} m`);
const tailZ = z - 0.36;
check("streamer trails behind the tail", poly[poly.length - 1][2] < tailZ - 8, `free end z=${poly[poly.length - 1][2].toFixed(1)}, tail z=${tailZ.toFixed(1)}`);
check("streamer starts as intact", st.intact, "intact");

// Attacker crosses the streamer 5 m behind the tail, flying along +x at the same height: prop disc faces +x.
const mid = poly.reduce((best, p) => Math.abs(p[2] - (tailZ - 5)) < Math.abs(best[2] - (tailZ - 5)) ? p : best);
const hitFrom = pose(mid[0] - 0.8, mid[1], mid[2], 1, 0, 0), hitTo = pose(mid[0] + 0.1, mid[1], mid[2], 1, 0, 0);
const hit = findCut(hitFrom, hitTo, geom, poly);
check("cut when flying through the streamer", hit && hit.arc > 3 && hit.arc < 7, hit ? `cut at ${hit.arc.toFixed(1)} m from the tail` : "no cut");
st.cut(hit.arc);
check("cut shortens and loses protection", !st.intact && st.length < 7, `${st.length.toFixed(1)} m left, intact=${st.intact}`);

// Miss: 3 m above.
const miss = findCut(pose(mid[0] - 0.8, mid[1] + 3, mid[2], 1, 0, 0), pose(mid[0] + 0.1, mid[1] + 3, mid[2], 1, 0, 0), geom, poly);
check("no cut when missing", miss === null, "no cut");

// Tunnelling: attacker moves 4 m in one frame through the streamer.
const fast = findCut(pose(mid[0] - 2, mid[1], mid[2], 1, 0, 0), pose(mid[0] + 2, mid[1], mid[2], 1, 0, 0), geom, poly);
check("no tunnelling at speed", fast !== null, fast ? "cut" : "missed");

// Wing leading edge cuts too: no prop (radius 0), attacker heads 45 degrees across the streamer, wing sweeps it.
const d = Math.SQRT1_2;
const edge = findCut(
  { pos: [mid[0] - 1, mid[1], mid[2] - 1], fwd: [d, 0, d], right: [d, 0, -d] },
  { pos: [mid[0] + 0.5, mid[1], mid[2] + 0.5], fwd: [d, 0, d], right: [d, 0, -d] },
  { ...geom, propRadius: 0 }, poly);
check("wing leading edge cuts", edge !== null, edge ? `cut at ${edge.arc.toFixed(1)} m` : "no cut");

// Streamer on the ground at launch: hangs/lies behind, does not go underground.
const g = new Streamer(); g.reset([0, 1.4, -3]);
const gp = g.points(0);
check("held streamer stays above ground", gp.every((p) => p[1] >= 0.02 - 1e-9) && gp.length > 5, `${gp.length} points`);
process.exit(fail ? 1 : 0);
