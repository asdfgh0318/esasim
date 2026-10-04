// Electric Kato style flying wing: swept wing with tip fins, a small pod and a pusher prop. Original work (CC0), NOT PicaSim's model (its meshes and
// textures need the authors' permission); the proportions follow the numbers in PicaSim's Aeroplane.xml for the Electric Kato (span 1.21 m, chord 0.29 m at the
// root and 0.22 m at the tip panel, 24 degrees of sweep, fins at the tips, pusher prop 0.16 m), see shared/picasim/katoDef.js.
// Units mm, native size (span 1210 mm); axes: x lateral, y up, z forward, origin at the centre of gravity, like esa_plane.scad. The client scales the whole
// plane by span / 1210. Export one part at a time:  openscad -D 'part="wing"' -o wing.stl kato.scad
// parts: fuselage, wing, tail, canopy, spinner, prop
part = "wing";

CG = 49;                          // the definition's origin is 49 mm ahead of the centre of gravity: z = definition x + CG
function lez(y) = y < 300 ? 155 - 124 * y / 300 : 31 - 135 * (y - 300) / 300;           // leading edge (definition x) at lateral position y
function tez(y) = y < 300 ? -135 - 90 * y / 300 : -225 - 99 * (y - 300) / 300;          // trailing edge
function thick(y) = 13 - 7 * y / 605;
module slice(y, t) { translate([y, 0, (lez(y) + tez(y)) / 2 + CG]) cube([0.4, thick(y) * t, lez(y) - tez(y)], center = true); }
module wing_half() { for (y = [0 : 50 : 550]) hull() { slice(y, 1); slice(y + 50, 1); } hull() { slice(550, 1); slice(605, 1); } }
module wing() { wing_half(); mirror([1, 0, 0]) wing_half(); }
module fin(sgn) {                  // vertical fin at the wing tip, trailing edge flush with the tip chord
  hull() {
    translate([sgn * 598, -55, tez(605) + 118 + CG - 120 + 50]) cube([3, 2, 120], center = true);
    translate([sgn * 598,  60, tez(605) +  75 + CG - 120 + 50]) cube([3, 2,  75], center = true);
  }
}
module tail() { fin(1); fin(-1); }
module fuselage() {                // small pod from the nose to just before the pusher prop
  hull() {
    translate([0, 0, 170 + CG]) scale([22, 20, 40]) sphere(1, $fn = 24);
    translate([0, 0, 30 + CG]) scale([32, 28, 90]) sphere(1, $fn = 24);
    translate([0, 0, -110 + CG]) scale([14, 12, 30]) sphere(1, $fn = 24);
  }
}
module canopy() { translate([0, 24, 70 + CG]) scale([20, 14, 60]) sphere(1, $fn = 24); }
module spinner() { translate([0, 0, -125 + CG - 6]) rotate([180, 0, 0]) cylinder(r1 = 14, r2 = 2, h = 24, $fn = 24); }     // cone pointing backwards behind the pod
module prop() {                    // 160 mm two-blade prop, hub at the origin, disc in the xy plane (the client moves it to z = -125 + CG - 6 - 4)
  for (a = [0, 180]) rotate([0, 0, a]) hull() { translate([6, 0, 0]) cylinder(r = 4, h = 2, $fn = 12); translate([78, 0, 0]) cylinder(r = 3, h = 1.5, $fn = 12); }
}
if (part == "fuselage") fuselage();
else if (part == "wing") wing();
else if (part == "tail") tail();
else if (part == "canopy") canopy();
else if (part == "spinner") spinner();
else if (part == "prop") prop();
