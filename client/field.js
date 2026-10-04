import * as THREE from "three";
import { FIELD } from "../shared/rules.js";

// Builds the contest site from Fig 1. Axes: x across the field, z away from pilots (toward the flight area), y up.
// z = 0 is the pilot line.
export function buildField() {
  const g = new THREE.Group();
  const line = (z, color, w = 120) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.15), new THREE.MeshBasicMaterial({ color }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, z); g.add(m);
  };
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x3f7a3a }));
  grass.rotation.x = -Math.PI / 2; g.add(grass);

  line(0, 0xffffff, FIELD.pitCount * FIELD.pitSpacing + 6);            // pilot line
  line(FIELD.safetyLineGap, 0xff2a2a, 120);                             // safety line §2.2.3
  line(-FIELD.readinessGap - FIELD.startPit, 0x2aa84a, 60);             // readiness line §2.3

  for (let i = 0; i < FIELD.pitCount; i++) {                            // start pits 3x3 m, Fig 1
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.startPit, FIELD.startPit), new THREE.MeshBasicMaterial({ color: 0x555555 }));
    pit.rotation.x = -Math.PI / 2;
    pit.position.set((i - (FIELD.pitCount - 1) / 2) * FIELD.pitSpacing, 0.01, -FIELD.startPit / 2);
    g.add(pit);
  }
  const lf = FIELD.landingField;                                        // landing field 20 x 75 m, Fig 1
  const land = new THREE.Mesh(new THREE.PlaneGeometry(lf.w, lf.d), new THREE.MeshBasicMaterial({ color: 0xb59b6a }));
  land.rotation.x = -Math.PI / 2;
  land.position.set(0, 0.01, FIELD.safetyLineGap + lf.d / 2 + 2);
  g.add(land);
  return g;
}
