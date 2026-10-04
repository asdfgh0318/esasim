import * as THREE from "three";

// Crepe-paper ribbon drawn from a polyline [x,y,z,x,y,z,...] (from the server, or from a local Streamer offline).
// The real streamer is 1 cm wide (ESA §3.7); the ribbon is drawn wider (VISUAL) so it can be seen from the pilot box.
export class StreamerView {
  constructor(scene, color = 0xff7ab8, width = 0.07) {
    this.width = width;
    this.geo = new THREE.BufferGeometry();
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh); this.scene = scene; this.n = 0;
  }
  setColor(c) { this.mesh.material.color.set(c); }
  update(flat) {
    const n = Math.floor(flat.length / 3);
    if (n < 2) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    if (n !== this.n) {                                                   // rebuild index when the length changes (cuts)
      this.n = n;
      this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
      const idx = [];
      for (let i = 0; i < n - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      this.geo.setIndex(idx);
    }
    const pos = this.geo.attributes.position.array, t = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const j = Math.min(i + 1, n - 1), k = Math.max(i - 1, 0);
      t.set(flat[3 * j] - flat[3 * k], flat[3 * j + 1] - flat[3 * k + 1], flat[3 * j + 2] - flat[3 * k + 2]);
      side.crossVectors(t, up); if (side.lengthSq() < 1e-8) side.set(1, 0, 0); side.normalize().multiplyScalar(this.width / 2);
      pos.set([flat[3 * i] - side.x, flat[3 * i + 1] - side.y, flat[3 * i + 2] - side.z, flat[3 * i] + side.x, flat[3 * i + 1] + side.y, flat[3 * i + 2] + side.z], 6 * i);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.mesh); this.geo.dispose(); this.mesh.material.dispose(); }
}
