import * as THREE from "three";
import { FIELD, FIGHT, pitX } from "../shared/rules.js";

// Contest site per ESA 2024 §2. x across, z away from the pilots, z = 0 is the safety line (§2.1).
export function buildField() {
  const g = new THREE.Group();
  const flat = (w, d, x, z, color, y = 0.01) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(m); return m;
  };
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x3f7a3a });                                // plain green until the texture arrives
  new THREE.TextureLoader().load("/textures/grass_leafy_grass_diff_1k.jpg", (tex) => {                 // Poly Haven CC0 grass (see NOTICE)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(110, 110); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    grassMat.map = tex; grassMat.color.setHex(0xb8c8a8); grassMat.needsUpdate = true;
  });
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), grassMat);
  grass.rotation.x = -Math.PI / 2; g.add(grass);

  const lf = FIELD.landingField;
  flat(lf.w, lf.d, 0, FIELD.safetyLineZ + lf.d / 2, 0xb59b6a);                          // landing field 50 x 20 m, §2.2.2 (red-white tape)
  for (const sx of [-1, 1]) flat(0.2, lf.d, sx * lf.w / 2, lf.d / 2, 0xffffff, 0.02);
  flat(lf.w, 0.2, 0, lf.d, 0xffffff, 0.02);

  const width = FIELD.flightZone.w;
  flat(width, 0.3, 0, FIELD.safetyLineZ, 0xff2a2a, 0.03);                               // safety line §2.2.4 (red-white tape)
  flat(width, 0.15, 0, FIELD.pilotLineZ, 0xffffff);                                      // pilot line, 3 m behind
  flat(width / 2, 0.15, 0, FIELD.pilotLineZ - FIELD.readinessGap, 0x2aa84a);             // readiness line §2.2.5
  flat(width, 0.15, 0, FIELD.audienceZ, 0xffd166);                                       // audience zone starts §2.3
  for (let i = 0; i < FIGHT.maxPilots; i++) flat(2, 1.5, pitX(i), FIELD.pilotLineZ - 1.2, 0x555555);  // start boxes (size DESIGN)
  return g;
}
