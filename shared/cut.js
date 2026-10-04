// Cut detection (Adam's decision: prop disc vs streamer). ESA §4.11 mentions the prop, the leading edge and
// the tail surfaces as cutters, so besides the prop disc the wing leading edge is a cutter too (sandpaper
// "karabiny" are allowed on it, §3.1). All geometry is swept between two frames so a fast pass cannot tunnel.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

// Closest distance between segments p1-q1 and p2-q2, and the parameter on the first one (0..1).
export function segSeg(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  if (a < 1e-12 && e < 1e-12) { s = t = 0; }
  else if (a < 1e-12) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = dot(d1, r);
    if (e < 1e-12) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  const c1 = add(p1, mul(d1, s)), c2 = add(p2, mul(d2, t));
  return { dist: len(sub(c1, c2)), s };
}

// Segment p-q against triangle (t0,t1,t2): returns the parameter on p-q or -1 (Moller-Trumbore).
function segTri(p, q, t0, t1, t2) {
  const d = sub(q, p), e1 = sub(t1, t0), e2 = sub(t2, t0);
  const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return -1;
  const f = 1 / det, sv = sub(p, t0), u = f * dot(sv, h);
  if (u < 0 || u > 1) return -1;
  const qv = [sv[1] * e1[2] - sv[2] * e1[1], sv[2] * e1[0] - sv[0] * e1[2], sv[0] * e1[1] - sv[1] * e1[0]];
  const v = f * dot(d, qv);
  if (v < 0 || u + v > 1) return -1;
  const t = f * dot(e2, qv);
  return t >= 0 && t <= 1 ? t : -1;
}

// from/to: pose at the previous and current frame, pose = { pos:[x,y,z], fwd:[x,y,z], right:[x,y,z] } (unit vectors).
// geom: { noseZ, wingLeZ, span, propRadius }. tol: forgiveness added to the streamer's 1 cm width (DESIGN).
// poly: streamer polyline, tail to free end. Returns { arc } (metres from the tail) of the earliest hit, or null.
// Exact swept tests: the prop is a capsule along the nose path (a disc flying along its axis sweeps a cylinder),
// the wing leading edge is a swept quad, so a fast pass cannot tunnel through the streamer.
export function findCut(from, to, geom, poly, tol = 0.03) {
  if (poly.length < 2) return null;
  const at = (pose, z) => add(pose.pos, mul(pose.fwd, z));
  const n0 = at(from, geom.noseZ), n1 = at(to, geom.noseZ);
  const half0 = mul(from.right, geom.span / 2), half1 = mul(to.right, geom.span / 2);
  const le0 = at(from, geom.wingLeZ), le1 = at(to, geom.wingLeZ);
  const A0 = add(le0, half0), B0 = sub(le0, half0), A1 = add(le1, half1), B1 = sub(le1, half1);
  const up = [0, tol, 0], dn = [0, -tol, 0];
  const R = geom.propRadius + tol;
  let arc = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1], segLen = len(sub(b, a));
    let u = -1;
    if (geom.propRadius > 0) { const r = segSeg(a, b, n0, n1); if (r.dist <= R) u = r.s; }
    if (u < 0) {
      for (const off of [[0, 0, 0], up, dn]) {
        const pa = add(a, off), pb = add(b, off);
        let t = segTri(pa, pb, A0, B0, A1); if (t < 0) t = segTri(pa, pb, B0, B1, A1);
        if (t >= 0) { u = t; break; }
      }
    }
    if (u >= 0) return { arc: arc + u * segLen };
    arc += segLen;
  }
  return null;
}
