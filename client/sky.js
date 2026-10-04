import * as THREE from "three";

// Procedural sky (no image files): a blue gradient, haze toward the horizon, fractal-noise clouds and a sun, painted on an
// equirectangular canvas and used as the scene background.
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {                                            // value noise, tileable in x with period px
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => { let s = 0, a = 0.5; for (let o = 0; o < 6; o++) { s += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; };
const mix = (a, b, t) => a + (b - a) * t;

export function makeSky(w = 1024, h = 512) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d"), img = ctx.createImageData(w, h);
  const zen = [58, 118, 205], hor = [196, 222, 242], sunAz = 0.28, sunEl = 0.42;     // sun azimuth (fraction of the circle) and elevation (rad)
  for (let j = 0; j < h; j++) {
    const el = (0.5 - (j + 0.5) / h) * Math.PI;                    // +90 deg at the top, -90 at the bottom
    const up = Math.max(0, Math.sin(el));                          // 0 at the horizon, 1 at the zenith
    const g = Math.pow(up, 0.55);
    for (let i = 0; i < w; i++) {
      const az = (i / w) * Math.PI * 2;
      let r = mix(hor[0], zen[0], g), gr = mix(hor[1], zen[1], g), b = mix(hor[2], zen[2], g);
      if (el < 0) { const t = Math.min(1, -el * 3); r = mix(hor[0], 120, t); gr = mix(hor[1], 150, t); b = mix(hor[2], 150, t); }   // haze below the horizon
      else {
        // clouds: noise over a plane projected from the sky (larger and flatter toward the horizon)
        const k = 1 / (0.18 + up), px = Math.cos(az) * k * 1.4, py = Math.sin(az) * k * 1.4;
        const n = fbm(px + 11.3, py + 7.7);
        const cl = Math.min(1, Math.max(0, (n - 0.5) * 3.2)) * Math.min(1, up * 6 + 0.1);
        const shade = 0.88 + 0.12 * fbm(px * 2.2 + 40, py * 2.2 + 3);
        r = mix(r, 255 * shade, cl * 0.92); gr = mix(gr, 255 * shade, cl * 0.92); b = mix(b, 255 * shade, cl * 0.92);
        // sun disc and glow
        const dAz = Math.atan2(Math.sin(az - sunAz * Math.PI * 2), Math.cos(az - sunAz * Math.PI * 2)), dEl = el - sunEl;
        const dist = Math.hypot(dAz * Math.cos(el), dEl);
        const glow = Math.exp(-dist * dist * 40) * 0.5 + (dist < 0.035 ? 1 : 0);
        r = Math.min(255, r + 255 * glow); gr = Math.min(255, gr + 245 * glow); b = Math.min(255, b + 200 * glow * 0.8);
      }
      const o = 4 * (j * w + i); img.data[o] = r; img.data[o + 1] = gr; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
