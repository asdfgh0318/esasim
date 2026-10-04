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
