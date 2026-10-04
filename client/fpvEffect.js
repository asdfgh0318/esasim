// Analog FPV look: the picture degrades with distance from the pilot like a 5.8 GHz video link:
// scanlines and colour fringing close in, then horizontal tearing and snow, finally "signal lost" static.
// The signal model lives in shared/vtx.js (range by VTX power, interference from other pilots' transmitters).

export const FpvShader = {
  uniforms: { tDiffuse: { value: null }, tFeedB: { value: null }, time: { value: 0 }, noise: { value: 0 }, interf: { value: 0 }, aspect: { value: 1.78 }, texel: { value: [1 / 1280, 1 / 720] } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform sampler2D tFeedB; uniform float time; uniform float noise; uniform float interf; uniform float aspect; uniform vec2 texel; varying vec2 vUv;
    float h2(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 1.7) * 43758.5453); }
    void main(){
      vec2 uv = vUv; float n = noise;
      float line = floor(uv.y * 240.0);
      float tear = step(0.985 - 0.25 * n, hash(vec2(line * 0.07, floor(time * 12.0))));      // occasional torn bands
      uv.x += (hash(vec2(line, 1.0)) - 0.5) * 0.012 * n * n + tear * (hash(vec2(line, 2.0)) - 0.5) * 0.12 * n;
      float ca = 0.0008 + 0.006 * n;                                                          // colour fringing (subtle when the link is good)
      vec3 c = vec3(texture2D(tDiffuse, uv + vec2(ca, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.0)).b);
      // a touch of sharpening while the link is good (unsharp mask), fading out as the signal degrades
      vec3 bl = 0.25 * (texture2D(tDiffuse, uv + vec2(texel.x, 0.0)).rgb + texture2D(tDiffuse, uv - vec2(texel.x, 0.0)).rgb + texture2D(tDiffuse, uv + vec2(0.0, texel.y)).rgb + texture2D(tDiffuse, uv - vec2(0.0, texel.y)).rgb);
      c += (c - bl) * 0.45 * (1.0 - n);
      if (interf > 0.01) {                                                                    // a neighbour at 100 mW max: now and then a short horizontal glitch line, nothing else
        float win = floor(time * 4.0);                                                          // events live for a quarter of a second
        float ev = step(h2(vec2(win, 91.0)), 0.035 * interf);                                   // rare: about one event every 7 s at full interference, one a minute at low levels
        float ly = h2(vec2(win, 7.0)), lh = (1.0 + floor(h2(vec2(win, 3.0)) * 3.0)) / 540.0;    // 1 to 3 pixel rows tall
        float x0 = h2(vec2(win, 13.0)) * 0.6, wl = 0.12 + h2(vec2(win, 17.0)) * 0.35;           // covering only part of the width
        float on = ev * step(abs(vUv.y - ly), lh) * step(x0, vUv.x) * step(vUv.x, x0 + wl);
        vec3 shifted = texture2D(tDiffuse, vUv + vec2((h2(vec2(win, 19.0)) - 0.5) * 0.02, 0.0)).rgb;
        c = mix(c, shifted + 0.06, on * 0.85);
      }
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.97 - 0.55 * n);                                                    // washed-out colour
      c *= 0.94 + 0.06 * sin(uv.y * 240.0 * 3.14159);                                           // scanlines
      float snow = hash(uv * vec2(aspect * 520.0, 520.0));
      c = mix(c, vec3(snow), clamp(n * n * 0.6 + smoothstep(0.7, 1.0, n) * 0.9, 0.0, 1.0));   // snow, full static near the end of the range
      c += (snow - 0.5) * 0.04 * (0.2 + n);
      vec2 d = vUv - 0.5; c *= 1.0 - 0.35 * dot(d, d);                                         // lens vignette
      gl_FragColor = vec4(c, 1.0);
    }`,
};
