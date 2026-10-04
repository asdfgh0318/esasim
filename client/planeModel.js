import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";

// Plane models: STL parts exported from models/scad/esa_plane.scad (OpenSCAD, units mm, nose +Z, y up, origin near the CG).
export const PLANE_TYPES = ["spitfire", "hurricane", "fw190", "yak3", "kato"];
export const PLANE_NAMES = { spitfire: "Spitfire", hurricane: "Hurricane", fw190: "FW 190", yak3: "Yak-3", kato: "Electric Kato (flying wing)" };
const CAMO = { spitfire: 0x86a057, hurricane: 0x7d9356, fw190: 0xa3b1c0, yak3: 0x93a866, kato: 0xe9e4d2 };   // VISUAL only
const loader = new STLLoader(), cache = new Map();

function load(type, part, smooth) {
  const key = `${type}/${part}`;
  if (!cache.has(key)) cache.set(key, new Promise((res, rej) => loader.load(`/models/${type}/${part}.stl`, (g) => {
    if (smooth) { g.deleteAttribute("normal"); g = mergeVertices(g, 0.01); }
    g.computeVertexNormals(); res(g);
  }, undefined, rej)));
  return cache.get(key);
}

// Aerobatic stripes (Adam): chordwise bands on the wings in the pilot's colour, alternating with white on the top surface and with black on the
// underside, so the plane is easy to see against the sky or the grass and top and bottom are easy to tell apart (VISUAL only). The wing geometry
// is in millimetres, a band is 36 mm wide; the stripe colour is the pilot's tint Color object, so setTint() recolours it.
function stripedWing(base, tintColor) {
  const m = new THREE.MeshLambertMaterial({ color: base, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uStripe = { value: tintColor };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vOP; varying float vTop;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvOP = position; vTop = normal.y;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uStripe; varying vec3 vOP; varying float vTop;").replace("#include <color_fragment>",
      "#include <color_fragment>\nfloat band = step(0.5, fract(vOP.x / 36.0));\nvec3 other = vTop >= 0.0 ? vec3(0.95) : vec3(0.05);\ndiffuseColor.rgb = mix(diffuseColor.rgb, mix(other, uStripe, band), 0.92);");
  };
  return m;
}

// Returns a Group right away (a small box until the parts arrive). group.userData: { tint: [materials], prop: Mesh|null }.
export function createPlane(type = "spitfire", tint = 0xd23b3b, opts = {}) {
  const g = new THREE.Group();
  const tintMat = new THREE.MeshLambertMaterial({ color: tint, side: THREE.DoubleSide }), camo = new THREE.MeshLambertMaterial({ color: CAMO[type] || 0x667755, side: THREE.DoubleSide });
  g.userData = { tint: [tintMat], prop: null, type };
  const stub = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.55), camo); g.add(stub);
  const parts = [["fuselage", camo, true], ["wing", stripedWing(CAMO[type] || 0x667755, tintMat.color), false], ["tail", tintMat, false], ["canopy", new THREE.MeshLambertMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0.75 }), true],
    ["spinner", tintMat, true], ["prop", new THREE.MeshLambertMaterial({ color: 0x222222, side: THREE.DoubleSide }), false]];
  Promise.all(parts.map(([p, m, s]) => load(type, p, s).then((geo) => {
    const mesh = new THREE.Mesh(geo, m), k = type === "kato" ? (opts.spanMm || 800) / 1210 : 1;   // the Kato model is drawn at its native 1210 mm and scaled as a whole
    mesh.scale.setScalar(0.001 * k);
    if (p === "wing" && opts.spanMm && type !== "kato") mesh.scale.x = 0.001 * opts.spanMm / 800;           // workshop span
    if (p === "prop") { mesh.position.z = type === "kato" ? -0.094 * k : ESA_WWII.noseZ; g.userData.prop = mesh; }   // the Kato's prop pushes from behind the pod
    g.add(mesh);
  }))).then(() => g.remove(stub)).catch((e) => console.warn("plane model failed", type, e));
  return g;
}
export function setTint(group, color) { group.userData.tint.forEach((m) => m.color.setHex(color)); }
export function spinProp(group, rate, dt) { if (group.userData.prop) group.userData.prop.rotation.z += rate * dt; }
