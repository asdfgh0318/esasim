// Analog video link model (ESASIM-specific, DESIGN: ESA has no rules on video transmitters).
// Each plane carries a VTX with a power and a channel. At a pilot's receiver (at his start box) the wanted signal is
// P_own / d_own^2; every other airborne VTX leaks in as overlap(channel) * P / d^2. A blaster (5 W) flying close to
// your box swamps your own signal even on another channel, and you see its picture through yours.
export const VTX_POWERS = [25, 200, 600, 1500, 5000];          // mW; 25 mW is race mode
export const CHANNELS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"];
export const overlap = (a, b) => { const d = Math.abs(a - b); return d === 0 ? 1 : d === 1 ? 0.2 : 0.03; };   // adjacent channels leak, far ones barely

// Range grows with sqrt(power): 25 mW is clean up to 20 m and gone at 95 m (the field is small, so it is noticeable).
export const vtxRange = (mw) => { const k = Math.sqrt(mw / 25); return { clean: 20 * k, lost: 95 * k }; };
export const signalQuality = (d, mw) => { const r = vtxRange(mw); return Math.min(1, Math.max(0, 1 - (d - r.clean) / (r.lost - r.clean))) ** 0.8; };

// me: { mw, ch }, dMe: distance of my plane from my receiver; others: [{ id, mw, ch, d }] = airborne planes, d = distance to MY receiver.
// Returns { level 0..1 (share of interference in the received power), source (strongest interferer id or null) }.
export function interference(me, dMe, others) {
  const own = me.mw / (dMe * dMe + 4);
  let total = 0, best = null;
  for (const o of others) {
    const i = overlap(me.ch, o.ch) * o.mw / (o.d * o.d + 4);
    total += i; if (!best || i > best.i) best = { id: o.id, i };
  }
  return { level: total / (total + own), source: best && best.i > 0.05 * (total + own) ? best.id : null };
}

// Random power for bots: mostly race mode, some forgot to turn it down (the 5 W blasters).
export function randomPower(rnd = Math.random()) { return rnd < 0.45 ? 25 : rnd < 0.75 ? 200 : rnd < 0.87 ? 600 : 5000; }
