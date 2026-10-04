// Editable physics parameters. A plane build can carry `paramOverrides`: { "wings[Left2].CLPerDegree": 0.03, ... }.
// Paths: settings.X | dynamics.X | aerofoils.NAME.X | wings[NAME].X | fuselages[NAME].X | engines[NAME].X | shapes[NAME].X, vectors as .0 .1 .2
// (positions and extents in the aeroplane definition's frame: X forward, Y left, Z up). Applied on top of the generated definition,
// on the client and on the server (so the legality checks of the workshop see the same numbers).
const GROUPS = ["settings", "dynamics", "aerofoils", "wings", "fuselages", "engines", "shapes"];

function locate(def, path) {
  const tokens = path.split(".");
  let node, rest;
  const m = /^(wings|fuselages|engines|shapes)\[([^\]]+)\]$/.exec(tokens[0]);
  if (m) { node = (def[m[1]] || []).find((x) => x.name === m[2]); rest = tokens.slice(1); }
  else if (tokens[0] === "aerofoils") { node = def.aerofoils?.[tokens[1]]; rest = tokens.slice(2); }
  else if (tokens[0] === "settings" || tokens[0] === "dynamics") { node = def[tokens[0]]; rest = tokens.slice(1); }
  if (!node || !rest.length) return null;
  for (let i = 0; i < rest.length - 1; i++) { node = node[rest[i]]; if (node == null || typeof node !== "object") return null; }
  return { obj: node, key: rest[rest.length - 1] };
}

export function applyOverrides(def, ov) {
  if (!ov) return def;
  for (const [path, v] of Object.entries(ov)) {
    const n = Number(v);
    if (!Number.isFinite(n) || Math.abs(n) > 1e4) continue;            // ignore garbage
    const loc = locate(def, path);
    if (loc && typeof loc.obj[loc.key] === "number") loc.obj[loc.key] = n;
  }
  return def;
}

// Every editable number of a definition, grouped, with its current value: [{ path, group, label, value }]
export function listParams(def) {
  const out = [];
  const walk = (obj, prefix, group, label) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k === "name" || k === "src" || k === "aerofoil") continue;
      const p = `${prefix}.${k}`;
      if (typeof v === "number") out.push({ path: p, group, label: `${label} ${k}`, value: v });
      else if (Array.isArray(v) && v.every((x) => typeof x === "number")) v.forEach((x, i) => out.push({ path: `${p}.${i}`, group, label: `${label} ${k}.${"xyz"[i] ?? i}`, value: x }));
      else if (v && typeof v === "object" && !Array.isArray(v) && (k === "controlPerChannel" || k === "washFromEngine")) walk(v, p, group, `${label} ${k}`);
    }
  };
  walk(def.settings || {}, "settings", "Aeroplane settings", "");
  walk(def.dynamics || {}, "dynamics", "Aeroplane settings", "");
  for (const [n, a] of Object.entries(def.aerofoils || {})) walk(a, `aerofoils.${n}`, `Aerofoil ${n}`, "");
  for (const g of ["wings", "fuselages", "engines", "shapes"]) for (const x of def[g] || []) if (!x.copy) walk(x, `${g}[${x.name}]`, `${g[0].toUpperCase()}${g.slice(1, -1)} ${x.name}`, "");
  return out;
}
export const isOverridePath = (p) => typeof p === "string" && GROUPS.includes(p.split(/[.[]/)[0]);
