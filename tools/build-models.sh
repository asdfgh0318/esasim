#!/usr/bin/env bash
# Export every plane/part of models/scad/esa_plane.scad to public/models/<plane>/<part>.stl (needs openscad).
set -e
cd "$(dirname "$0")/.."
for plane in spitfire hurricane fw190 yak3; do
  mkdir -p "public/models/$plane"
  for part in fuselage wing tail canopy spinner prop; do
    openscad -q -D "plane=\"$plane\"" -D "part=\"$part\"" -o "public/models/$plane/$part.stl" models/scad/esa_plane.scad
  done
  echo "$plane done"
done
# the PicaSim-inspired flying wing (original model, native 1210 mm size)
mkdir -p public/models/kato
for part in fuselage wing tail canopy spinner prop; do
  openscad -q -D "part=\"$part\"" -o "public/models/kato/$part.stl" models/scad/kato.scad
done
echo "kato done"
