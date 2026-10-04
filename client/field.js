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
    grassMat.map = tex; grassMat.color.setHex(0xa4d48c); grassMat.needsUpdate = true;
  });
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), grassMat);
  grass.rotation.x = -Math.PI / 2; g.add(grass);

  const lf = FIELD.landingField;
  landingStrip(g, lf);                                                                  // landing field 50 x 20 m, §2.2.2 (tape): mown grass
  for (const sx of [-1, 1]) flat(0.2, lf.d, sx * lf.w / 2, lf.d / 2, 0xffffff, 0.02);
  flat(lf.w, 0.2, 0, lf.d, 0xffffff, 0.02);

  treeLine(g);
  contestDressing(g);
  countryside(g);
  const width = FIELD.flightZone.w;
  flat(width, 0.3, 0, FIELD.safetyLineZ, 0xff2a2a, 0.03);                               // safety line §2.2.4 (red-white tape)
  flat(width, 0.15, 0, FIELD.pilotLineZ, 0xffffff);                                      // pilot line, 3 m behind
  flat(width / 2, 0.15, 0, FIELD.pilotLineZ - FIELD.readinessGap, 0x2aa84a);             // readiness line §2.2.5
  flat(width, 0.15, 0, FIELD.audienceZ, 0xffd166);                                       // audience zone starts §2.3
  for (let i = 0; i < FIGHT.maxPilots; i++) flat(2, 1.5, pitX(i), FIELD.pilotLineZ - 1.2, 0x555555);  // start boxes (size DESIGN)
  return g;
}

// Landing field: ordinary mown grass, a little lighter than the rest, marked only by tape (as at real ESA contests, e.g. the
// Dobroszyce 2016 and Plock pitches: plain grass, tape lines, a tree line behind). Soft edges, no stripes.
function landingStrip(group, lf) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d");
  const g = x.createRadialGradient(128, 64, 10, 128, 64, 150); g.addColorStop(0, "rgba(190,215,120,0.55)"); g.addColorStop(0.7, "rgba(190,215,120,0.4)"); g.addColorStop(1, "rgba(190,215,120,0)");
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(lf.w + 8, lf.d + 6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.012, FIELD.safetyLineZ + lf.d / 2); group.add(m);
}

// Tree line around the pitch (VISUAL): simple blobs on trunks, deterministic, far enough to stay clear of the flight zone (ESA §2: free of trees > 100 m).
function treeLine(group) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const trunk = new THREE.CylinderGeometry(0.4, 0.6, 6, 6), crown = new THREE.IcosahedronGeometry(1, 1);
  const spots = [];
  for (let i = 0; i < 70; i++) { const t = rnd(), side = rnd(); spots.push(side < 0.6 ? [-230 + t * 460, 200 + rnd() * 30] : [(side < 0.8 ? -1 : 1) * (130 + rnd() * 30), -20 + t * 220]); }
  const tr = new THREE.InstancedMesh(trunk, new THREE.MeshLambertMaterial({ color: 0x4a3a2a }), spots.length);
  const cr = new THREE.InstancedMesh(crown, new THREE.MeshLambertMaterial({ color: 0xffffff }), spots.length);
  const d = new THREE.Object3D(), col = new THREE.Color();
  spots.forEach(([px, pz], i) => {
    const h = 7 + rnd() * 6;
    d.position.set(px, 3, pz); d.scale.set(1, h / 6, 1); d.rotation.set(0, 0, 0); d.updateMatrix(); tr.setMatrixAt(i, d.matrix);
    d.position.set(px, h * 0.8, pz); d.scale.set(4 + rnd() * 3, h * 0.55, 4 + rnd() * 3); d.updateMatrix(); cr.setMatrixAt(i, d.matrix);
    cr.setColorAt(i, col.setHSL(0.25 + rnd() * 0.06, 0.4, 0.2 + rnd() * 0.1));
  });
  group.add(tr, cr);
}

// Contest dressing (VISUAL, modelled on how model-flying contests look in general: banner fence behind the spectators, canopy
// tents, flags, a windsock, a judges' table). Banners carry generic/fictional names, no real brands. Everything sits behind the
// audience line (ESA §2.3, >= 10 m behind the safety line) and clear of the pilots.
function contestDressing(group) {
  const banner = (text, bg, fg, w = 6, h = 2.2) => {
    const c = document.createElement("canvas"); c.width = 512; c.height = Math.round(512 * h / w); const x = c.getContext("2d");
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.fillStyle = fg; x.font = `bold ${c.height * 0.55}px sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, c.width / 2, c.height / 2 + 3);
    x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(3, 3, c.width - 6, c.height - 6);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace }), side: THREE.DoubleSide }));
    return m;
  };
  const zb = 98;                                                                         // banner fence on the far edge of the site, facing the pilots (who look toward +z)
  const names = [["ESASIM", "#1b3a6b", "#ffffff"], ["FLY ESA", "#c8102e", "#ffffff"], ["AIR COMBAT", "#f2c200", "#222222"], ["ESASIM", "#ffffff", "#1b3a6b"], ["FOAM · PAPER · FUN", "#2a7a3a", "#ffffff"], ["FLY ESA", "#222222", "#f2c200"]];
  for (let i = 0; i < 9; i++) {
    const [t, bg, fg] = names[i % names.length], b = banner(t, bg, fg);
    b.position.set(-25 + i * 6.2, 1.25, zb); b.rotation.y = Math.PI; group.add(b);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.04, 0.04), new THREE.MeshLambertMaterial({ color: 0x888888 })); rail.position.set(-25 + i * 6.2, 0.25, zb); group.add(rail);
  }
  const tent = (x, z, color) => {                                                       // 3 x 3 m pop-up canopy
    const t = new THREE.Group(), pole = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    for (const [px, pz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), pole); p.position.set(px, 1.2, pz); t.add(p); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 0.7, 4), new THREE.MeshLambertMaterial({ color })); roof.rotation.y = Math.PI / 4; roof.position.y = 2.75; t.add(roof);
    t.position.set(x, 0, z); group.add(t);
  };
  tent(-46, 6, 0xffffff); tent(-41, 6, 0x1b3a6b); tent(-46, 12, 0xc8102e); tent(46, 8, 0xffffff);
  // judges' table with chairs, off to the side of the pilot line
  const table = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 0.8), new THREE.MeshLambertMaterial({ color: 0x8a6a45 })); table.position.set(-34, 0.75, 4); group.add(table);
  for (let i = 0; i < 3; i++) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshLambertMaterial({ color: 0x2a3a5a })); ch.position.set(-35 + i, 0.23, 2.8); group.add(ch); }
  // flags (PL, DE, CZ) and a windsock beside the landing field
  const flag = (x, z, top, bottom) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 6, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd })); pole.position.set(x, 3, z); group.add(pole);
    const c = document.createElement("canvas"); c.width = 30; c.height = 20; const g = c.getContext("2d");
    for (let i = 0; i < top.length; i++) { g.fillStyle = top[i]; g.fillRect(0, i * (20 / top.length), 30, 20 / top.length + 0.5); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace }), side: THREE.DoubleSide })); m.position.set(x + 0.8, 5.4, z); group.add(m);
  };
  const fz = 12;
  flag(-30, fz, ["#ffffff", "#dc143c"]); flag(-28, fz, ["#000000", "#dd0000", "#ffce00"]); flag(-26, fz, ["#ffffff", "#d7141a"]); 
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.6, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xff5a1f, side: THREE.DoubleSide })); sock.rotation.z = -Math.PI / 2; sock.position.set(36, 4.6, 12);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4.6, 6), new THREE.MeshLambertMaterial({ color: 0xdddddd })); sp.position.set(35.4, 2.3, 12); group.add(sp, sock);
}

// Countryside around the site (VISUAL): wheat fields beyond the grass, a powerline and a wind turbine in the back.
function countryside(group) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256; const x = c.getContext("2d");
  x.fillStyle = "#c9a54a"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 4) { x.fillStyle = i % 8 ? "rgba(235,200,100,0.35)" : "rgba(150,115,40,0.3)"; x.fillRect(i, 0, 2, 256); }
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? "240,215,120" : "140,105,40"},0.25)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 5); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const field = (w, d, cx, cz, rot = 0, col = 0xffffff, rep = 1) => {
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w / 12 * rep, d / 12 * rep); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: t, color: col })); m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(cx, 0.03, cz); group.add(m);
  };
  field(150, 400, -230, 100, 0, 0xffffff);                                                // wheat left and right of the site, a green-ish unripe one for variety
  field(150, 400, 230, 100, 0, 0xb8d070);
  field(300, 70, 0, 135, 0.0, 0xffffff);                                                    // wheat band behind the far banner fence
  // powerline running across the back: pylons and sagging wires
  const wire = new THREE.LineBasicMaterial({ color: 0x222222 }), post = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
  const pz = 175, xs = [];
  for (let px = -260; px <= 260; px += 65) xs.push(px);
  for (const px of xs) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 13, 6), post); p.position.set(px, 6.5, pz); group.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 5), post); arm.position.set(px, 12.4, pz); group.add(arm);
  }
  for (const dz of [-2.2, 0, 2.2]) for (let i = 0; i < xs.length - 1; i++) {
    const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(xs[i] + (xs[i + 1] - xs[i]) * t, 12.4 - 3.2 * Math.sin(Math.PI * t), pz + dz)); }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
  }
  // wind turbine on the horizon
  const wt = new THREE.Group(), white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 80, 12), white); tower.position.y = 40; wt.add(tower);
  const nac = new THREE.Mesh(new THREE.BoxGeometry(4, 3.5, 9), white); nac.position.set(0, 81, 1); wt.add(nac);
  const rotor = new THREE.Group(); rotor.position.set(0, 81, -4);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 38, 0.4), white); b.geometry.translate(0, 19, 0); b.rotation.z = i * 2 * Math.PI / 3 + 0.4; rotor.add(b); }
  wt.add(rotor); wt.position.set(120, 0, 320); wt.rotation.y = 0.2; group.add(wt);
  const wt2 = wt.clone(true); wt2.position.set(-90, 0, 380); wt2.scale.setScalar(0.9); group.add(wt2);
}
