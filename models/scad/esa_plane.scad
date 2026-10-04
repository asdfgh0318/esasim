// ESA-style foam fighter, parametric. Original work (CC0). Units: mm. Axes: x right, y up, z forward, origin near the CG,
// so an STL loads straight into the sim after scaling by 0.001 (nose along +Z, y up).
// Proportions follow an ESA WWII kit: span 800 mm, length about 600 mm, tail surfaces as flat EPP plates, wing dihedral 60 mm at the tip
// (ef3m.pl Hurricane ESA kit page and build guide, see docs/models.md). Outlines are stylised, not a scale drawing.
//
// Export one part at a time, e.g.:
//   openscad -D 'plane="spitfire"' -D 'part="wing"' -o wing.stl esa_plane.scad
// parts: fuselage, wing, tail, canopy, spinner, prop
plane = "spitfire";
part = "fuselage";

// ---- per-plane data ----
// Fuselage stations from nose to tail: [z, yTop, yBottom, halfWidth]
function stations(p) =
  p == "spitfire" ? [[225,22,-20,16],[200,32,-28,23],[120,38,-32,26],[40,52,-30,24],[-40,48,-28,22],[-140,38,-22,15],[-250,28,-12,9],[-335,22,-6,4]] :
  p == "hurricane" ? [[225,26,-24,19],[190,36,-32,26],[110,44,-34,27],[30,62,-32,25],[-60,58,-26,20],[-160,42,-18,13],[-260,30,-10,8],[-335,24,-4,3]] :
  p == "fw190" ? [[225,34,-34,31],[200,40,-38,34],[130,40,-36,28],[40,52,-30,24],[-50,46,-26,19],[-150,36,-18,12],[-250,28,-10,8],[-335,22,-4,3]] :
  /* yak3 */      [[225,22,-20,16],[190,28,-26,21],[110,36,-30,23],[30,50,-28,22],[-60,44,-26,18],[-160,34,-18,12],[-255,26,-9,7],[-335,20,-4,3]];

SPAN = 800;                  // ESA WWII single-engine: 700-860 mm (§3.1.2)
function chordAt(p, u) =     // u = 0 root .. 1 tip
  p == "spitfire" ? 52 + 98 * sqrt(1 - u * u) :           // elliptical planform
  p == "hurricane" ? 160 - 70 * u :
  p == "fw190" ? 150 - 62 * u :
  /* yak3 */        145 - 66 * u;
function teAt(p, u) = p == "spitfire" ? -100 : -100 + (p == "fw190" ? 14 * u : 0);  // trailing edge z (spitfire: straight TE)
WING_Y = -10;                // low wing, root height
DIHEDRAL = 60;               // tip height above root (kit guide: 60 mm)
N = 8;                       // wing stations per half

// ---- helpers ----
module slice(z, yt, yb, hw) { translate([0, (yt + yb) / 2, z]) scale([hw, (yt - yb) / 2, 1]) cylinder(r = 1, h = 0.2, $fn = 24); }
module fuselage() {
  st = stations(plane);
  for (i = [0 : len(st) - 2]) hull() { slice(st[i][0], st[i][1], st[i][2], st[i][3]); slice(st[i+1][0], st[i+1][1], st[i+1][2], st[i+1][3]); }
}
// airfoil-ish section (flat bottom, domed top) at span position x, chord from te to le, thickness t, height y
module section(x, y, le, te, t) {
  c = le - te;
  multmatrix([[0,0,1,x],[0,1,0,y],[1,0,0,te],[0,0,0,1]])    // 2D (a,b) -> (z = te + a, y = y + b), extruded along x
    linear_extrude(height = 0.4) polygon([[0,0],[c*0.02,t*0.55],[c*0.25,t],[c*0.6,t*0.6],[c,0.4],[c*0.6,0],[c*0.1,0]]);
}
module wing_half(sgn) {
  for (i = [0 : N - 1]) {
    u0 = i / N; u1 = (i + 1) / N;
    c0 = chordAt(plane, u0); c1 = chordAt(plane, u1);
    hull() {
      section(sgn * u0 * SPAN / 2, WING_Y + DIHEDRAL * u0, teAt(plane, u0) + c0, teAt(plane, u0), c0 * 0.10);
      section(sgn * u1 * SPAN / 2, WING_Y + DIHEDRAL * u1, teAt(plane, u1) + c1, teAt(plane, u1), c1 * 0.08);
    }
  }
}
module wing() { wing_half(1); wing_half(-1); }
module plate_h(span, c_root, c_tip, z_te, y, t) {         // flat EPP stabiliser
  translate([0, y, 0]) linear_extrude(height = t, center = true)
    polygon([[-span/2, z_te + c_tip], [-span/2, z_te], [span/2, z_te], [span/2, z_te + c_tip], [0.0, z_te + c_root]]);
}
module tail() {
  // horizontal plate: lies in the xz plane at height 8 mm, 6 mm thick
  rotate([90, 0, 0]) translate([0, 0, -8 - 3]) linear_extrude(height = 6)
    polygon([[-140, -300], [-140, -335], [140, -335], [140, -300], [0, -245]]);
  // fin: vertical plate in the yz plane at x = 0, 6 mm thick. 2D (a,b) -> (z = a, y = b), extruded along x.
  multmatrix([[0,0,1,-3],[0,1,0,0],[1,0,0,0],[0,0,0,1]]) linear_extrude(height = 6)
    polygon([[-335, 10], [-335, 112], [-300, 108], [-225, 18]]);
}
module canopy() {
  translate([0, 50, plane == "hurricane" ? 20 : 45]) scale([19, 16, 52]) sphere(r = 1, $fn = 20);
}
module spinner() { translate([0, 0, 225]) rotate([0, 0, 0]) cylinder(r1 = 30, r2 = 2, h = 42, $fn = 28); }
module prop() {   // 9 in (229 mm) two-blade prop, hub at the origin, disc in the xy plane
  for (a = [0, 180]) rotate([0, 0, a]) hull() { translate([0, 6, 0]) cylinder(r = 5, h = 3, $fn = 12); translate([0, 112, 0]) scale([7, 2, 1]) cylinder(r = 1, h = 2, $fn = 12); }
}

if (part == "fuselage") fuselage();
else if (part == "wing") wing();
else if (part == "tail") tail();
else if (part == "canopy") canopy();
else if (part == "spinner") spinner();
else if (part == "prop") prop();
