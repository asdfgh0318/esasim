// Gusty air (DESIGN: ESA has no wind rule, the contests are outdoors). Smooth, deterministic in time and position,
// so every plane flies in the same air. amp = typical gust speed in m/s.
export function windAt(t, x = 0, z = 0, amp = 1.2) {
  const a = Math.sin(0.31 * t + 0.07 * x) + 0.6 * Math.sin(0.83 * t - 0.11 * z + 1.3) + 0.4 * Math.sin(1.7 * t + 0.05 * (x + z) + 2.1);
  const b = Math.sin(0.27 * t - 0.09 * z + 0.4) + 0.6 * Math.sin(0.91 * t + 0.1 * x + 2.2);
  return [amp * 0.5 * a, amp * 0.15 * Math.sin(0.5 * t + 0.1 * x), amp * 0.5 * b];
}
