import { t } from "./i18n.js";
import * as THREE from "three";
import { createPlane } from "./planeModel.js";

// Beginner orientation widget (top-right corner): a small copy of your plane shown the way the pilot sees it from the start box,
// so "nose toward me / away / left / right / upside down" is obvious. Orange sphere = left wing tip, blue cube = right wing tip (colour and shape differ for colour-blind players),
// yellow arrow = nose. The model's +x axis is the plane's LEFT (see shared/flight.js), so the left marker sits at +x.
const SIZE = 150, MARGIN = 10;

export function createOrientationWidget(type, tint) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(1, 2, 2); scene.add(sun);
  const bg = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40), new THREE.MeshBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.5, depthTest: false }));
  bg.position.z = -2; bg.renderOrder = -2; scene.add(bg);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.03, 1.07, 48), new THREE.MeshBasicMaterial({ color: 0x9cc9ee, transparent: true, opacity: 0.8, depthTest: false })); ring.position.z = -1.99; ring.renderOrder = -1; scene.add(ring);
  const g = new THREE.Group(); scene.add(g);
  const plane = createPlane(type, tint); plane.scale.setScalar(1.15); g.add(plane);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 14), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  arrow.rotation.x = Math.PI / 2; arrow.position.z = 0.62; g.add(arrow);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.36; g.add(shaft);
  // Colour-blind friendly: left = orange SPHERE, right = blue CUBE (shape and colour differ; the old red/green pair is the hardest to tell apart).
  const lamp = (x, color, geo) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color })); m.position.set(x, 0.01, 0); g.add(m); };
  lamp(0.42, 0xff7a1a, new THREE.SphereGeometry(0.06, 14, 14)); lamp(-0.42, 0x2aa8ff, new THREE.BoxGeometry(0.1, 0.1, 0.1));   // +x = left wing tip, -x = right wing tip
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 20); cam.position.set(0, 0, 2.5);
  const f = new THREE.Vector3(), up = new THREE.Vector3(), ref = new THREE.Quaternion(), m4 = new THREE.Matrix4(), tmp = new THREE.Quaternion();

  return {
    // eye = the pilot's eyes (start box), target = the plane, planeQuat = its orientation. Returns the label text.
    update(eye, target, planeQuat) {
      m4.lookAt(eye, target, up.set(0, 1, 0)); ref.setFromRotationMatrix(m4);                  // the view from the pilot's eyes
      tmp.copy(ref).invert().multiply(planeQuat); g.quaternion.copy(tmp);                      // plane orientation as seen from there
      f.set(0, 0, 1).applyQuaternion(tmp);                                                       // nose in view space: +x screen-right, +y up, +z toward the viewer
      up.set(0, 1, 0).applyQuaternion(planeQuat);
      const parts = [];
      if (f.z > 0.45) parts.push(t("o.toward")); else if (f.z < -0.45) parts.push(t("o.away"));
      if (f.x > 0.45) parts.push(t("o.right")); else if (f.x < -0.45) parts.push(t("o.left"));
      if (f.y > 0.45) parts.push(t("o.climb")); else if (f.y < -0.45) parts.push(t("o.dive"));
      let txt = parts.length ? t("o.nose") + " " + parts.join(", ") : t("o.side");
      if (up.y < -0.2) txt += " · " + t("o.upside");
      else if (Math.abs(up.x * 0 + (new THREE.Vector3(1, 0, 0).applyQuaternion(planeQuat).y)) > 0.45) txt += new THREE.Vector3(1, 0, 0).applyQuaternion(planeQuat).y > 0 ? " · " + t("o.bankR") : " · " + t("o.bankL");
      return txt;
    },
    render(renderer) {
      const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
      renderer.setScissorTest(true); renderer.setViewport(w - SIZE - MARGIN, h - SIZE - MARGIN, SIZE, SIZE); renderer.setScissor(w - SIZE - MARGIN, h - SIZE - MARGIN, SIZE, SIZE);
      const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, cam); renderer.autoClear = ac;
      renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
    },
  };
}
