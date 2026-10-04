import { CHANNELS } from "./radio.js";

// Radio setup panel (toggle with R): raw axes, channel mapping and invert, calibration, mapped outputs, save/load.
const css = `
#radio{position:fixed;right:12px;top:12px;width:330px;max-height:92vh;overflow:auto;background:#121c30ee;color:#e6edf7;border:1px solid #2b3d5e;border-radius:10px;padding:12px 14px;z-index:4;display:none}
#radio h3{margin:0 0 8px;font-size:15px} #radio h4{margin:12px 0 4px;font-size:12px;color:#9cc9ee;text-transform:uppercase}
#radio .row{display:flex;align-items:center;gap:8px;margin:3px 0;font-size:12px} #radio .lbl{width:64px}
#radio .bar{flex:1;height:12px;background:#0b1220;border-radius:3px;position:relative;overflow:hidden}
#radio .fill{position:absolute;top:0;bottom:0;background:#2ad47a} #radio .val{width:42px;text-align:right;font-variant-numeric:tabular-nums}
#radio select{background:#0b1220;color:#e6edf7;border:1px solid #2b3d5e;border-radius:4px} #radio button{margin:6px 6px 0 0;padding:6px 10px;border:0;border-radius:6px;background:#2b3d5e;color:#fff;cursor:pointer}
#radio button.on{background:#d23b3b} #radio .hint{font-size:11px;color:#9aa8bf;margin-top:6px}`;

export function mountRadioUI(radio) {
  document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
  const el = document.createElement("div"); el.id = "radio";
  el.innerHTML = `<h3>Radio</h3><div id="r-status" class="hint"></div>
  <h4>Raw axes</h4><div id="r-raw"></div>
  <h4>Channels</h4><div id="r-map"></div>
  <button id="r-cal">Start calibration</button><button id="r-save">Save</button><button id="r-reset">Reset</button>
  <div class="hint">Calibration: hands off the sticks for half a second after pressing Start, then move every stick to all extremes (and throttle full range), then press Stop.</div>`;
  document.body.append(el);
  addEventListener("keydown", (e) => { if (e.code === "KeyR") el.style.display = el.style.display === "block" ? "none" : "block"; });

  const bar = (id, signed) => `<div class="bar"><div class="fill" id="${id}"></div></div>`;
  let nAxes = -1;
  const $ = (id) => el.querySelector("#" + id);

  function buildAxes() {
    $("r-raw").innerHTML = radio.raw.map((_, i) => `<div class="row"><span class="lbl">Axis ${i}</span>${bar("ra" + i)}<span class="val" id="rv${i}">0.00</span></div>`).join("");
    $("r-map").innerHTML = CHANNELS.map((ch, i) => {
      const opts = radio.raw.map((_, a) => `<option value="${a}" ${radio.config.mapping[i] === a ? "selected" : ""}>Axis ${a}</option>`).join("");
      return `<div class="row"><span class="lbl">${ch}</span><select data-i="${i}">${opts}</select>
        <label><input type="checkbox" data-inv="${i}" ${radio.config.inverted[i] ? "checked" : ""}> inv</label>${bar("rc" + i)}<span class="val" id="rcv${i}">0.00</span></div>`;
    }).join("");
    el.querySelectorAll("select[data-i]").forEach((s) => s.onchange = () => { radio.config.mapping[+s.dataset.i] = +s.value; });
    el.querySelectorAll("input[data-inv]").forEach((c) => c.onchange = () => { radio.config.inverted[+c.dataset.inv] = c.checked; });
    nAxes = radio.raw.length;
  }
  const setBar = (id, v, signed) => {
    const f = $(id); if (!f) return;
    if (signed) { f.style.left = (v < 0 ? 50 + v * 50 : 50) + "%"; f.style.width = Math.abs(v) * 50 + "%"; }
    else { f.style.left = "0"; f.style.width = v * 100 + "%"; }
  };

  $("r-cal").onclick = () => {
    if (!radio.connected) return;
    if (radio.calibrating) { radio.stopCalibration(); $("r-cal").textContent = "Start calibration"; $("r-cal").classList.remove("on"); }
    else { radio.startCalibration(); $("r-cal").textContent = "Stop calibration"; $("r-cal").classList.add("on"); }
  };
  $("r-save").onclick = () => { $("r-status").textContent = radio.save() ? "Saved." : "Could not save (storage blocked)."; };
  $("r-reset").onclick = () => { radio.reset(); nAxes = -1; };

  return function update() {
    if (el.style.display !== "block") return;
    if (!radio.connected) { $("r-status").textContent = "No radio found. Plug it in USB (joystick mode) and move a stick."; nAxes = -1; return; }
    if (radio.raw.length !== nAxes) buildAxes();
    $("r-status").textContent = radio.id;
    radio.raw.forEach((v, i) => { setBar("ra" + i, v, true); $("rv" + i).textContent = v.toFixed(2); });
    CHANNELS.forEach((ch, i) => { const v = radio.channels[ch]; setBar("rc" + i, v, ch !== "throttle"); $("rcv" + i).textContent = v.toFixed(2); });
  };
}
