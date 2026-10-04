import { listParams } from "../shared/picasim/overrides.js";
import { buildEsaDef } from "../shared/picasim/esaDef.js";
import { validate } from "../shared/workshop.js";

// Advanced physics editor: every number of the plane definition (PicaSim-style aeroplane parameters). Edits are stored in
// build.paramOverrides, applied on rejoin, and the weighed mass / span stay under the ESA checks (shared/workshop.js).
const css = `
#pp{position:fixed;inset:5vh 8vw;background:#0f1828f7;color:#e6edf7;border:1px solid #2b3d5e;border-radius:12px;padding:14px 18px;z-index:6;display:none;font:13px system-ui,sans-serif;overflow:hidden}
#pp .top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px} #pp h3{margin:0;font-size:16px}
#pp input[type=search]{flex:1;min-width:160px;background:#0b1220;color:#e6edf7;border:1px solid #2b3d5e;border-radius:6px;padding:6px 8px}
#pp .list{height:calc(100% - 96px);overflow:auto;padding-right:6px} #pp details{margin:6px 0;border:1px solid #1d2b45;border-radius:8px;padding:4px 8px} #pp summary{cursor:pointer;color:#9cc9ee}
#pp .row{display:flex;align-items:center;gap:8px;margin:3px 0} #pp .row label{flex:1;font-size:12px;color:#c9d6ea} #pp .row input{width:120px;background:#0b1220;color:#e6edf7;border:1px solid #2b3d5e;border-radius:5px;padding:3px 5px}
#pp .row.changed input{border-color:#ffd166;color:#ffd166} #pp .row .def{width:96px;font-size:11px;color:#7d8da8;text-align:right}
#pp button{padding:6px 12px;border:0;border-radius:6px;background:#2b3d5e;color:#fff;cursor:pointer} #pp button.go{background:#d23b3b}
#pp .status{font-size:12px} #pp .ok{color:#2ad47a} #pp .bad{color:#ff7a7a}`;

export function mountPhysicsPanel(build, apply) {
  document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
  const el = document.createElement("div"); el.id = "pp";
  el.innerHTML = `<div class="top"><h3>Advanced physics</h3><input type="search" id="pp-q" placeholder="filter, e.g. Left2, CLPerDegree, Engine, mass">
    <span class="status" id="pp-st"></span><button id="pp-apply" class="go">Apply and rejoin</button><button id="pp-reset">Reset all</button><button id="pp-export">Export</button><button id="pp-import">Import</button><button id="pp-close">Close</button></div>
    <div class="hint" style="color:#8ea0bd;font-size:11px;margin-bottom:6px">PicaSim-style parameters (X forward, Y left, Z up, metres, kg, degrees). Yellow = changed from the ESA default. The 15 Wh, 450 g and span limits still apply; anything illegal scores 0 for the round (§6).</div>
    <div class="list" id="pp-list"></div>`;
  document.body.append(el);
  const $ = (id) => el.querySelector("#" + id);
  const base = listParams(buildEsaDef({ ...build, paramOverrides: undefined }));
  const ov = { ...(build.paramOverrides || {}) };
  const groups = new Map();
  for (const p of base) { if (!groups.has(p.group)) groups.set(p.group, []); groups.get(p.group).push(p); }
  const stepFor = (v) => { const a = Math.abs(v); return a === 0 ? 0.001 : Math.max(1e-5, +(10 ** (Math.floor(Math.log10(a)) - 1)).toPrecision(1)); };
  const rows = [];
  for (const [g, list] of groups) {
    const d = document.createElement("details"); d.innerHTML = `<summary>${g} (${list.length})</summary>`; if (g === "Aeroplane settings") d.open = true;
    for (const p of list) {
      const r = document.createElement("div"); r.className = "row"; r.dataset.text = `${p.group} ${p.label} ${p.path}`.toLowerCase();
      const cur = ov[p.path] ?? p.value;
      r.innerHTML = `<label title="${p.path}">${p.label.trim()}</label><input type="number" step="${stepFor(p.value)}" value="${cur}"><span class="def">${+p.value.toPrecision(5)}</span>`;
      const inp = r.querySelector("input");
      inp.oninput = () => { const n = Number(inp.value); if (Number.isFinite(n) && n !== p.value) ov[p.path] = n; else delete ov[p.path]; r.classList.toggle("changed", p.path in ov); refresh(); };
      r.classList.toggle("changed", p.path in ov); d.append(r); rows.push(r);
    }
    $("pp-list").append(d);
  }
  function refresh() {
    const r = validate({ ...build, paramOverrides: ov });
    $("pp-st").innerHTML = `${Object.keys(ov).length} edits · ${r.massG.toFixed(0)} g · ${r.ok ? '<span class="ok">legal</span>' : '<span class="bad">' + r.problems.map((p) => p.rule).join(", ") + ' broken</span>'}`;
  }
  $("pp-q").oninput = () => { const q = $("pp-q").value.toLowerCase().trim(); for (const r of rows) r.style.display = !q || r.dataset.text.includes(q) ? "" : "none"; if (q) el.querySelectorAll("details").forEach((d) => (d.open = true)); };
  $("pp-apply").onclick = () => apply({ ...build, paramOverrides: { ...ov } });
  $("pp-reset").onclick = () => apply({ ...build, paramOverrides: {} });
  $("pp-close").onclick = () => (el.style.display = "none");
  $("pp-export").onclick = () => { const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify({ esasimPhysics: 1, build: { ...build, paramOverrides: ov } }, null, 1)], { type: "application/json" })), download: "esasim-plane.json" }); a.click(); URL.revokeObjectURL(a.href); };
  $("pp-import").onclick = () => { const t = prompt("Paste an exported plane JSON"); if (!t) return; try { const j = JSON.parse(t); if (j.build) apply(j.build); } catch { alert("Not valid JSON"); } };
  refresh();
  addEventListener("esasim:physics", () => { el.style.display = el.style.display === "block" ? "none" : "block"; });
  return { toggle: () => dispatchEvent(new Event("esasim:physics")) };
}
