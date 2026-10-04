// Fight HUD: phase banner with countdown, score table, event toasts, lobby buttons.
const css = `
#fh{position:fixed;inset:0;pointer-events:none;font:14px system-ui,sans-serif;color:#e6edf7;text-shadow:0 1px 2px #000;z-index:3}
#fh .banner{position:absolute;top:12px;left:50%;transform:translateX(-50%);text-align:center;background:#0b1220cc;border:1px solid #2b3d5e;border-radius:10px;padding:8px 18px;min-width:280px}
#fh .banner b{font-size:20px;display:block} #fh .banner span{font-size:12px;color:#9cc9ee}
#fh .score{position:absolute;left:12px;top:44px;background:#0b1220cc;border:1px solid #2b3d5e;border-radius:8px;padding:6px 8px;font-size:12px}
#fh .score table{border-collapse:collapse} #fh .score td,#fh .score th{padding:2px 8px;text-align:right} #fh .score td:first-child,#fh .score th:first-child{text-align:left}
#fh .score tr.me td{color:#ffd166;font-weight:600} #fh .score th{color:#9cc9ee;font-weight:500}
#fh .toasts{position:absolute;left:50%;top:96px;transform:translateX(-50%);display:flex;flex-direction:column;gap:4px;align-items:center}
#fh .toast{background:#121c30ee;border-left:4px solid #ffd166;border-radius:6px;padding:5px 12px;font-size:15px}
#fh .toast.bad{border-color:#ff5a5a} #fh .toast.good{border-color:#2ad47a}
#fh .lobby{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:8px;pointer-events:auto}
#fh .lobby button{white-space:nowrap;padding:9px 14px;font-size:14px;border:0;border-radius:8px;background:#2b3d5e;color:#fff;cursor:pointer}
#fh .lobby select{padding:8px;font-size:14px;border-radius:8px;border:0;background:#2b3d5e;color:#fff}
#fh .lobby button.go{background:#d23b3b} #fh .lobby button.on{background:#2a8a56}
#fh .batt{position:absolute;left:12px;bottom:12px;width:150px;height:18px;background:#0b1220cc;border:1px solid #2b3d5e;border-radius:6px;overflow:hidden}
#fh .batt div{height:100%;background:#2ad47a;width:100%} #fh .batt span{position:absolute;left:8px;top:1px;font-size:11px}
#fh .orient{position:absolute;right:10px;top:168px;width:150px;text-align:center;font-size:12px;color:#e6edf7;background:#0b1220aa;border-radius:6px;padding:3px 4px}
#fh .vtxset{position:absolute;left:12px;bottom:36px;display:flex;gap:6px;align-items:center;pointer-events:auto;font-size:12px}
#fh .vtxset select{background:#0b1220cc;color:#e6edf7;border:1px solid #2b3d5e;border-radius:6px;padding:3px}
#fh .vtxset select:disabled{opacity:.45}
#fh .vtx{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);font:600 14px monospace;color:#9dff9d;text-shadow:0 0 4px #000;letter-spacing:1px}
#fh .cta{position:absolute;left:50%;bottom:80px;transform:translateX(-50%);max-width:520px;text-align:center;background:#121c30ee;border:1px solid #2b3d5e;border-radius:10px;padding:10px 16px;pointer-events:auto}
#fh .cta p{margin:6px 0;font-size:13px;color:#cfe0f5} #fh .cta a{color:#ffd166}
#fh .tips{position:absolute;left:12px;top:250px;max-width:300px;background:#121c30ee;border:1px solid #2b3d5e;border-radius:10px;padding:10px 14px;font-size:13px;pointer-events:auto}
#fh .tips ol{margin:6px 0 8px;padding-left:20px} #fh .tips li{margin:3px 0} #fh .tips button{padding:5px 12px;border:0;border-radius:6px;background:#2b3d5e;color:#fff;cursor:pointer}
#fh .voice{position:absolute;left:12px;bottom:62px;pointer-events:auto}
#fh .voice button{padding:5px 10px;border:0;border-radius:6px;background:#2b3d5e;color:#fff;cursor:pointer;font-size:12px} #fh .voice button.on{background:#2a8a56} #fh .voice button.err{background:#8a2a2a}
#fh .matchbar{position:absolute;top:12px;right:176px;display:flex;gap:6px;pointer-events:auto}
#fh .matchbar button{padding:6px 10px;font-size:12px;border:0;border-radius:6px;background:#2b3d5e;color:#fff;cursor:pointer} #fh .matchbar button#b-abort{background:#8a2a2a}
#fh .help{position:absolute;right:12px;bottom:12px;font-size:11px;color:#9aa8bf;text-align:right}`;

import { VTX_POWERS, CHANNELS } from "../shared/vtx.js";
import { t, toggleLang } from "./i18n.js";
const fmt = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;
const TEXT = Object.fromEntries(["lobby", "prep", "ready", "flight", "ended", "results"].map((k) => [k, [t("t." + k), t("s." + k)]]));
// Call to action after a fight: only links I fetched and read (docs/fly-for-real.md).
const CTA = [["ctaKits", "https://www.ef3m.pl/pl/c/Samoloty-rc-Aircombat-ESA/40"], ["ctaGuide", "https://www.ef3m.pl/pl/n/Aircombat-ESA-samoloty-rc-do-walk-powietrznych/44"], ["ctaTeams", "http://www.aircombat.pl/ACES/forum/viewforum.php?f=6"], ["ctaRules", "http://www.aircombat.pl/ACES/forum/viewtopic.php?t=21"]];

export function mountHud(actions, planes) {
  document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
  const el = document.createElement("div"); el.id = "fh";
  el.innerHTML = `<div class="banner"><b id="fh-t">ESASIM</b><span id="fh-s"></span></div>
    <div class="score" id="fh-score"></div><div class="toasts" id="fh-toasts"></div>
    <div class="lobby" id="fh-lobby"><select id="b-plane" title="${t("planeTip")}"></select><button id="b-ws">${t("workshop")}</button><button id="b-ready">${t("ready")}</button><button id="b-invite" title="${t("inviteTip")}">${t("invite")}</button><select id="b-level" title="${t("levelTip")}"><option value="easy">${t("easy")}</option><option value="club" selected>${t("club")}</option><option value="ace">${t("ace")}</option></select><button id="b-bot">${t("addBot")}</button><button id="b-nobot">${t("rmBots")}</button><button id="b-start" class="go">${t("start")}</button></div>
    <div class="matchbar" id="fh-match" style="display:none"><button id="b-abort">${t("abort")}</button><button id="b-leave">${t("leave")}</button></div>
    <div class="lobby" id="fh-replay" style="display:none"><button id="b-replay">${t("watch")}</button><button id="b-save">${t("saveReplay")}</button></div>
    <div class="batt" id="fh-batt"><div id="fh-batt-bar"></div><span id="fh-batt-t">${t("battery")}</span></div>
    <div class="orient" id="fh-orient"></div>
    <div class="vtxset" id="fh-vtxset"><span>VTX</span><select id="v-pow"></select><select id="v-ch"></select><span>${t("fov")}</span><select id="v-fov" title="${t("fovTip")}">${[40, 50, 60, 70, 80, 90].map((f) => `<option value="${f}">${f}°</option>`).join("")}</select><span>${t("fovFpv")}</span><select id="v-fovf" title="${t("fovFpvTip")}">${[60, 70, 80, 90, 100, 110, 120].map((f) => `<option value="${f}">${f}°</option>`).join("")}</select></div>
    <div class="vtx" id="fh-vtx" style="display:none"></div>
    <div class="help"><button id="b-lang" style="pointer-events:auto;font-size:11px;padding:1px 6px;margin-right:8px;border:0;border-radius:4px;background:#2b3d5e;color:#fff;cursor:pointer">${t("lang")}</button>${t("help")}</div>
    <div class="cta" id="fh-cta" style="display:none"></div>
    <div class="voice" id="fh-voice" style="display:none"><button id="b-voice"></button></div>
    <div class="tips" id="fh-tips" style="display:none"><b>${t("tipsT")}</b><ol>${["tip1", "tip2", "tip3", "tip4", "tip5"].map((k) => `<li>${t(k)}</li>`).join("")}</ol><button id="b-tips">${t("tipsOk")}</button></div>`;
  document.body.append(el);
  const $ = (id) => el.querySelector("#" + id);
  let ready = false;
  const pw = $("v-pow"), vc = $("v-ch");
  pw.innerHTML = VTX_POWERS.map((p) => `<option value="${p}">${p >= 1000 ? p / 1000 + " W" : p + " mW"}${p === 25 ? " race" : ""}</option>`).join("");
  vc.innerHTML = CHANNELS.map((c, i) => `<option value="${i}">${c}</option>`).join("");
  pw.title = t("vtxPow"); vc.title = t("vtxCh");
  pw.onchange = vc.onchange = () => actions.vtx(Number(pw.value), Number(vc.value));
  const sel = $("b-plane");
  sel.innerHTML = planes.types.map((t) => `<option value="${t}" ${t === planes.current ? "selected" : ""}>${planes.names[t]}</option>`).join("");
  sel.onchange = () => actions.plane(sel.value);
  $("b-ws").onclick = () => actions.workshop();
  $("b-replay").onclick = () => actions.replay(); $("b-save").onclick = () => actions.saveReplay();
  $("b-ready").onclick = () => { ready = !ready; $("b-ready").classList.toggle("on", ready); actions.ready(ready); };
  let tipsSeen = false; try { tipsSeen = localStorage.getItem("esasim-tips") === "1"; } catch { /* no storage */ }
  $("b-tips").onclick = () => { tipsSeen = true; $("fh-tips").style.display = "none"; try { localStorage.setItem("esasim-tips", "1"); } catch { /* ignore */ } };
  $("v-fov").onchange = () => actions.fov?.(Number($("v-fov").value));
  $("v-fovf").onchange = () => actions.fovFpv?.(Number($("v-fovf").value));
  $("b-abort").onclick = () => { if (confirm(t("abortAsk"))) actions.abort?.(); };
  $("b-leave").onclick = () => actions.leave?.();
  $("b-voice").onclick = () => actions.voice?.();
  $("b-voice").textContent = t("voiceOff");
  let speaking = new Set();
  $("b-lang").onclick = toggleLang;
  $("fh-cta").innerHTML = `<b>${t("ctaT")}</b><p>${t("ctaP")}</p>` + CTA.map(([k, u]) => `<a href="${u}" target="_blank" rel="noopener">${t(k)}</a>`).join(" · ");
  $("b-invite").onclick = actions.invite; $("b-bot").onclick = () => actions.addBot($("b-level").value); $("b-nobot").onclick = actions.removeBots; $("b-start").onclick = actions.start;

  return {
    offline() { $("fh-t").textContent = t("offlineT"); $("fh-s").textContent = t("offlineS"); $("fh-lobby").style.display = "none"; $("fh-score").style.display = "none"; },
    update(snap, meId) {
      const f = snap.fight, sr = snap.series || { label: "", prior: {}, winner: null }, [title, sub] = TEXT[f.phase] || ["", ""];
      $("fh-t").textContent = `${sr.label ? sr.label.replace(/^Round/, t("round")).replace(/^Final/, t("final")) + " · " : ""}${f.left > 0 ? `${title}  ${fmt(f.left)}` : title}`;
      $("fh-s").textContent = f.phase === "results" && sr.winner ? t("contestOver", { name: sr.winner.name, pts: sr.winner.total }) : sub;
      $("fh-lobby").style.display = f.phase === "lobby" || f.phase === "prep" ? "flex" : "none";
      $("fh-tips").style.display = !tipsSeen && (f.phase === "lobby" || f.phase === "prep") ? "block" : "none";   // first-flight guide until dismissed
      $("fh-cta").style.display = f.phase === "results" ? "block" : "none";
      const isHost = !snap.host || snap.host === meId;
      $("fh-match").style.display = "flex"; $("b-abort").style.display = isHost && f.phase !== "lobby" ? "" : "none";             // End match: host only, once something is running; Leave: always                              // only the host (the longest-present human) starts the fight and manages bots
      $("b-bot").style.display = $("b-level").style.display = $("b-nobot").style.display = $("b-start").style.display = f.phase === "lobby" && isHost ? "" : "none";
      if (f.phase === "lobby" && !isHost) $("fh-s").textContent = t("waitHost", { name: f.pilots.find((p) => p.id === snap.host)?.name || t("theHost") });
      if (f.phase === "lobby" || f.phase === "results") { ready = false; $("b-ready").classList.remove("on"); }
      const rows = [...f.pilots].sort((a, b) => ((sr.prior[b.id] || 0) + b.score) - ((sr.prior[a.id] || 0) + a.score)).map((p) =>
        `<tr class="${p.id === meId ? "me" : ""}"><td>${p.bot ? "🤖 " : ""}${speaking.has(p.id) ? "🔊 " : ""}${p.name.replace(/</g, "")}${p.illegal ? ` (${t("ill")})` : p.disqualified ? " (DQ)" : p.airborne ? " ✈" : ""}</td><td>${p.flight}</td><td>${p.cuts}</td><td>${p.crossings ? "-" + 200 * p.crossings : "0"}</td><td>${p.score}</td><td><b>${(sr.prior[p.id] || 0) + p.score}</b></td></tr>`).join("");
      $("fh-score").innerHTML = `<table><tr>${t("th").map((h) => `<th>${h}</th>`).join("")}</tr>${rows}</table>`;
    },
    setFov(v, fpv = false) { const s = $(fpv ? "v-fovf" : "v-fov"); if (![...s.options].some((o) => Number(o.value) === v)) s.add(new Option(v + "°", v)); s.value = String(v); },
    voiceAvailable(on) { $("fh-voice").style.display = on ? "block" : "none"; },
    voiceMode(mode) { const b = $("b-voice"); b.className = mode === "off" ? "" : mode === "error" ? "err" : "on"; b.textContent = t(mode === "ptt" ? "voicePtt" : mode === "open" ? "voiceOpen" : mode === "error" ? "voiceErr" : "voiceOff"); },
    setSpeaking(set) { speaking = set; },
    replayBar(show, playing) { $("fh-replay").style.display = show ? "flex" : "none"; $("b-replay").textContent = playing ? t("stopReplay") : t("watch"); },
    vtx(q, inter) {
      const el = $("fh-vtx"); if (q == null) { el.style.display = "none"; return; }
      el.style.display = "block"; el.style.color = q > 0.5 ? "#9dff9d" : q > 0.2 ? "#ffd166" : "#ff6a6a";
      const bars = `${"█".repeat(Math.ceil(q * 5))}${"░".repeat(5 - Math.ceil(q * 5))}`;
      let txt = q < 0.03 ? t("lost") : `VTX ${bars} ${Math.round(q * 100)}%`;
      if (inter && inter.level > 0.1 && inter.name) { txt += `   ⚠ ${t("interf")} ${Math.round(inter.level * 100)}%: ${inter.name} (${inter.ch}, ${inter.mw >= 1000 ? inter.mw / 1000 + " W" : inter.mw + " mW"})`; if (inter.level > 0.5) el.style.color = "#ff6a6a"; }
      el.textContent = txt;
    },
    setVtx(mw, ch) { if (document.activeElement !== pw && Number(pw.value) !== mw) pw.value = String(mw); if (document.activeElement !== vc && Number(vc.value) !== ch) vc.value = String(ch); },
    vtxEnabled(on) { if (pw.disabled === on) { pw.disabled = vc.disabled = !on; } },
    orient(t) { const e = $("fh-orient"); if (e.textContent !== t) e.textContent = t; },
    battery(p, dead) { $("fh-batt-bar").style.width = Math.round(p * 100) + "%"; $("fh-batt-bar").style.background = p > 0.25 ? "#2ad47a" : "#ff5a5a"; $("fh-batt-t").textContent = dead ? t("batteryEmpty") : `${t("battery")} ${Math.round(p * 100)}%`; },
    toast(text, kind = "") {
      const t = document.createElement("div"); t.className = "toast " + kind; t.textContent = text; $("fh-toasts").append(t);
      setTimeout(() => t.remove(), 4000);
    },
  };
}
