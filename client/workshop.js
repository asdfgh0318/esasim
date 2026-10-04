import { DEFAULT_BUILD, RANGES, validate, clampBuild } from "../shared/workshop.js";
import { VTX_POWERS, CHANNELS } from "../shared/vtx.js";
import { t as tr } from "./i18n.js";

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
const LABELS = { spanMm: [tr("w.span"), "mm"], batteryWh: [tr("w.battery"), "Wh"], propDiaIn: [tr("w.propD"), "in"], propPitchIn: [tr("w.propP"), "in"], ballastG: [tr("w.ballast"), "g"], aileronDeg: [tr("w.aileron"), "°"], elevatorDeg: [tr("w.elevator"), "°"], rudderDeg: [tr("w.rudder"), "°"] };

export function mountWorkshop(types, names, build) {
  document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
  const el = document.createElement("div"); el.id = "ws";
  const b = { ...build };
  el.innerHTML = `<h3>${tr("workshop")}</h3><div class="row"><label>${tr("w.plane")}</label><select id="ws-plane">${types.map((t) => `<option value="${t}" ${t === b.plane ? "selected" : ""}>${names[t]}</option>`).join("")}</select></div>
    ${Object.entries(RANGES).map(([k, [lo, hi, st]]) => `<div class="row"><label>${LABELS[k][0]}</label><input type="range" id="ws-${k}" min="${lo}" max="${hi}" step="${st}" value="${b[k]}"><span id="ws-v-${k}"></span></div>`).join("")}
    <div class="row"><label>${tr("w.video")}</label><select id="ws-vtxMw">${VTX_POWERS.map((p) => `<option value="${p}" ${p === b.vtxMw ? "selected" : ""}>${p >= 1000 ? p / 1000 + " W" : p + " mW"}${p === 25 ? " (" + tr("w.race") + ")" : ""}</option>`).join("")}</select>
      <select id="ws-vtxCh"><option value="-1" ${b.vtxCh < 0 ? "selected" : ""}>${tr("w.auto")}</option>${CHANNELS.map((c, i) => `<option value="${i}" ${i === b.vtxCh ? "selected" : ""}>${c}</option>`).join("")}</select></div>
    <div id="ws-mass" class="hint"></div><div id="ws-res"></div>
    <button id="ws-apply" class="go">${tr("w.apply")}</button><button id="ws-reset">${tr("w.reset")}</button><button id="ws-adv">${tr("w.adv")}</button>
    <div class="hint">${tr("w.hint")}</div>`;
  document.body.append(el);
  const $ = (id) => el.querySelector("#" + id);
  const refresh = () => {
    for (const k of Object.keys(RANGES)) { b[k] = Number($(`ws-${k}`).value); $(`ws-v-${k}`).textContent = `${b[k]} ${LABELS[k][1]}`; }
    b.plane = $("ws-plane").value; b.vtxMw = Number($("ws-vtxMw").value); b.vtxCh = Number($("ws-vtxCh").value);
    const r = validate(b);
    $("ws-mass").textContent = `${tr("w.mass")} ${r.massG.toFixed(0)} g`;
    $("ws-res").innerHTML = r.ok ? `<div class="ok">${tr("w.legal")}</div>` : r.problems.map((p) => `<div class="bad">${p.rule}: ${p.text}</div>`).join("");
  };
  el.querySelectorAll("input,select").forEach((i) => i.oninput = refresh); refresh();
  $("ws-apply").onclick = () => { saveBuild(clampBuild({ ...build, ...b })); location.reload(); };
  $("ws-adv").onclick = () => dispatchEvent(new Event("esasim:physics"));
  $("ws-reset").onclick = () => { saveBuild({ ...DEFAULT_BUILD, plane: b.plane }); location.reload(); };
  return { toggle: () => { el.style.display = el.style.display === "block" ? "none" : "block"; } };
}
