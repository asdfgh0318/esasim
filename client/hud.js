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
#fh .lobby button{padding:9px 16px;font-size:14px;border:0;border-radius:8px;background:#2b3d5e;color:#fff;cursor:pointer}
#fh .lobby select{padding:8px;font-size:14px;border-radius:8px;border:0;background:#2b3d5e;color:#fff}
#fh .lobby button.go{background:#d23b3b} #fh .lobby button.on{background:#2a8a56}
#fh .help{position:absolute;right:12px;bottom:12px;font-size:11px;color:#9aa8bf;text-align:right}`;

const fmt = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;
const TEXT = {
  lobby: ["Waiting room", "Add bots or wait for pilots, press Ready, then Start. Practice flights are fine (Space = hand launch)."],
  prep: ["Preparation", "Test flights allowed (ESA §4.2.1). Press Ready when you are set."],
  ready: ["Readiness", "Models stay in the boxes (§4.2.2). Flight starts at the whistle."],
  flight: ["FLIGHT", "Cut the others' streamers (+100). Keep your own. Stay in front of the safety line (-200)."],
  ended: ["Flight over: land", "Landing in the landing field now gives +20 (§4.7)."],
  results: ["Results", "A new fight starts in a moment."],
};

export function mountHud(actions, planes) {
  document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
  const el = document.createElement("div"); el.id = "fh";
  el.innerHTML = `<div class="banner"><b id="fh-t">ESASIM</b><span id="fh-s"></span></div>
    <div class="score" id="fh-score"></div><div class="toasts" id="fh-toasts"></div>
    <div class="lobby" id="fh-lobby"><select id="b-plane" title="Your plane (reloads the page)"></select><button id="b-ready">Ready</button><button id="b-bot">Add bot</button><button id="b-nobot">Remove bots</button><button id="b-start" class="go">Start fight</button></div>
    <div class="help">Space launch · P pilot view · C chase · V FPV · R radio</div>`;
  document.body.append(el);
  const $ = (id) => el.querySelector("#" + id);
  let ready = false;
  const sel = $("b-plane");
  sel.innerHTML = planes.types.map((t) => `<option value="${t}" ${t === planes.current ? "selected" : ""}>${planes.names[t]}</option>`).join("");
  sel.onchange = () => actions.plane(sel.value);
  $("b-ready").onclick = () => { ready = !ready; $("b-ready").classList.toggle("on", ready); actions.ready(ready); };
  $("b-bot").onclick = actions.addBot; $("b-nobot").onclick = actions.removeBots; $("b-start").onclick = actions.start;

  return {
    offline() { $("fh-t").textContent = "Offline practice"; $("fh-s").textContent = "No server: fly freely (Space = hand launch). Run npm run server for fights."; $("fh-lobby").style.display = "none"; $("fh-score").style.display = "none"; },
    update(snap, meId) {
      const f = snap.fight, sr = snap.series || { label: "", prior: {}, winner: null }, [title, sub] = TEXT[f.phase] || ["", ""];
      $("fh-t").textContent = `${sr.label ? sr.label + " · " : ""}${f.left > 0 ? `${title}  ${fmt(f.left)}` : title}`;
      $("fh-s").textContent = f.phase === "results" && sr.winner ? `Contest over. Winner: ${sr.winner.name} with ${sr.winner.total} points.` : sub;
      $("fh-lobby").style.display = f.phase === "lobby" || f.phase === "prep" ? "flex" : "none";
      $("b-bot").style.display = $("b-nobot").style.display = $("b-start").style.display = f.phase === "lobby" ? "" : "none";
      if (f.phase === "lobby" || f.phase === "results") { ready = false; $("b-ready").classList.remove("on"); }
      const rows = [...f.pilots].sort((a, b) => ((sr.prior[b.id] || 0) + b.score) - ((sr.prior[a.id] || 0) + a.score)).map((p) =>
        `<tr class="${p.id === meId ? "me" : ""}"><td>${p.bot ? "🤖 " : ""}${p.name.replace(/</g, "")}${p.disqualified ? " (DQ)" : p.airborne ? " ✈" : ""}</td><td>${p.flight}</td><td>${p.cuts}</td><td>${p.crossings ? "-" + 200 * p.crossings : "0"}</td><td>${p.score}</td><td><b>${(sr.prior[p.id] || 0) + p.score}</b></td></tr>`).join("");
      $("fh-score").innerHTML = `<table><tr><th>Pilot</th><th>time</th><th>cuts</th><th>line</th><th>fight</th><th>sum</th></tr>${rows}</table>`;
    },
    toast(text, kind = "") {
      const t = document.createElement("div"); t.className = "toast " + kind; t.textContent = text; $("fh-toasts").append(t);
      setTimeout(() => t.remove(), 4000);
    },
  };
}
