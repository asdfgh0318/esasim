import { DEFAULT_BUILD, RANGES, validate, clampBuild } from "../shared/workshop.js";
import { VTX_POWERS, CHANNELS } from "../shared/vtx.js";

// Workshop panel: tune the plane within the ESA limits. The build is saved in the browser and applied on rejoin.
const KEY = "esasim_build";
export function loadBuild() {
  try { return clampBuild({ ...DEFAULT_BUILD, ...JSON.parse(localStorage.getItem(KEY) || "{}") }); } catch { return { ...DEFAULT_BUILD }; }
}
export function saveBuild(b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* storage blocked */ } }

const css = `
#ws{position:fixed;left:12px;bottom:70px;width:340px;background:#121c30f2;color:#e6edf7;border:1px solid #2b3d5e;border-radius:10px;padding:12px 14px;z-index:4;display:none;font:13px system-ui,sans-serif}
#ws h3{margin:0 0 8px;font-size:15px} #ws .row{display:flex;align-items:center;gap:8px;margin:5px 0} #ws .row label{width:104px} #ws .row input[type=range]{flex:1} #ws .row span{width:58px;text-align:right}
#ws select{background:#0b1220;color:#e6edf7;border:1px solid #2b3d5e;border-radius:4px;padding:3px}
#ws .ok{color:#2ad47a;margin-top:8px} #ws .bad{color:#ff7a7a;margin-top:4px} #ws button{margin:10px 8px 0 0;padding:7px 12px;border:0;border-radius:6px;background:#2b3d5e;color:#fff;cursor:pointer}
#ws button.go{background:#d23b3b} #ws .hint{font-size:11px;color:#9aa8bf;margin-top:8px}`;
const LABELS = { spanMm: ["Wingspan", "mm"], batteryWh: ["Battery", "Wh"], propDiaIn: ["Prop diameter", "in"], propPitchIn: ["Prop pitch", "in"], ballastG: ["Ballast", "g"] };

export function mountWorkshop(types, names, build) {
  document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
  const el = document.createElement("div"); el.id = "ws";
  const b = { ...build };
  el.innerHTML = `<h3>Workshop</h3><div class="row"><label>Plane</label><select id="ws-plane">${types.map((t) => `<option value="${t}" ${t === b.plane ? "selected" : ""}>${names[t]}</option>`).join("")}</select></div>
    ${Object.entries(RANGES).map(([k, [lo, hi, st]]) => `<div class="row"><label>${LABELS[k][0]}</label><input type="range" id="ws-${k}" min="${lo}" max="${hi}" step="${st}" value="${b[k]}"><span id="ws-v-${k}"></span></div>`).join("")}
    <div class="row"><label>Video power</label><select id="ws-vtxMw">${VTX_POWERS.map((p) => `<option value="${p}" ${p === b.vtxMw ? "selected" : ""}>${p >= 1000 ? p / 1000 + " W" : p + " mW"}${p === 25 ? " (race mode)" : ""}</option>`).join("")}</select>
      <select id="ws-vtxCh"><option value="-1" ${b.vtxCh < 0 ? "selected" : ""}>Auto channel</option>${CHANNELS.map((c, i) => `<option value="${i}" ${i === b.vtxCh ? "selected" : ""}>${c}</option>`).join("")}</select></div>
    <div id="ws-mass" class="hint"></div><div id="ws-res"></div>
    <button id="ws-apply" class="go">Apply and rejoin</button><button id="ws-reset">Reset</button><button id="ws-adv">Advanced physics…</button>
    <div class="hint">ESA limits: span 700-860 mm (§3.1.2), mass 200-450 g (§3.6.2), battery max 15 Wh (§3.4). An illegal plane still flies but scores 0 for the round (§6). The battery drains with throttle. A strong video transmitter reaches far but swamps other pilots' video when you fly near their box (sim effect, not an ESA rule).</div>`;
  document.body.append(el);
  const $ = (id) => el.querySelector("#" + id);
  const refresh = () => {
    for (const k of Object.keys(RANGES)) { b[k] = Number($(`ws-${k}`).value); $(`ws-v-${k}`).textContent = `${b[k]} ${LABELS[k][1]}`; }
    b.plane = $("ws-plane").value; b.vtxMw = Number($("ws-vtxMw").value); b.vtxCh = Number($("ws-vtxCh").value);
    const r = validate(b);
    $("ws-mass").textContent = `Mass ${r.massG.toFixed(0)} g`;
    $("ws-res").innerHTML = r.ok ? '<div class="ok">Legal: counts for points.</div>' : r.problems.map((p) => `<div class="bad">${p.rule}: ${p.text}</div>`).join("");
  };
  el.querySelectorAll("input,select").forEach((i) => i.oninput = refresh); refresh();
  $("ws-apply").onclick = () => { saveBuild(clampBuild({ ...build, ...b })); location.reload(); };
  $("ws-adv").onclick = () => dispatchEvent(new Event("esasim:physics"));
  $("ws-reset").onclick = () => { saveBuild({ ...DEFAULT_BUILD, plane: b.plane }); location.reload(); };
  return { toggle: () => { el.style.display = el.style.display === "block" ? "none" : "block"; } };
}
