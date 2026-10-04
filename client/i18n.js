// Polish / English UI texts. Language: ?lang=pl|en, else the saved choice, else the browser language (Polish browsers get Polish).
// NB: the Polish wording is a first draft and needs a native speaker's read-through (Adam).
const dict = {
  en: {
    "t.lobby": "Waiting room", "s.lobby": "Add bots or wait for pilots, press Ready, then Start. Practice flights are fine (Space = hand launch).",
    "t.prep": "Preparation", "s.prep": "Test flights allowed (ESA §4.2.1). Press Ready when you are set.",
    "t.ready": "Readiness", "s.ready": "Models stay in the boxes (§4.2.2). Flight starts at the whistle.",
    "t.flight": "FLIGHT", "s.flight": "Cut the others' streamers (+100). Keep your own. Stay in front of the safety line (-200).",
    "t.ended": "Flight over: land", "s.ended": "Landing in the landing field now gives +20 (§4.7).",
    "t.results": "Results", "s.results": "A new fight starts in a moment.",
    "contestOver": "Contest over. Winner: {name} with {pts} points.",
    "waitHost": "Waiting for {name} to start the fight. Press Ready, practice flights are fine.", "theHost": "the host",
    "th": ["Pilot", "time", "cuts", "line", "fight", "sum"],
    "workshop": "Workshop", "ready": "Ready", "invite": "Private room", "inviteCopy": "Copy invite link", "addBot": "Add bot", "rmBots": "Remove bots", "start": "Start fight",
    "planeTip": "Your plane (reloads the page)", "inviteTip": "Open a private room and copy its invite link",
    "watch": "Watch replay", "stopReplay": "Stop replay", "saveReplay": "Save replay (JSON)",
    "battery": "battery", "batteryEmpty": "battery empty!",
    "help": "Space launch · WASD pitch/roll · Q/E yaw · Shift/Ctrl throttle · P pilot view · V FPV · R radio · M mute",
    "offlineT": "Offline practice", "offlineS": "No server: fly freely (Space = hand launch). Run npm run server for fights.",
    "vtxPow": "Video transmitter power (change with the model in your hand)", "vtxCh": "Video channel",
    "lost": "SIGNAL LOST", "interf": "INTERFERENCE", "ill": "ILLEGAL",
    "ctaT": "Liked it? Fly it for real.",
    "ctaP": "ESA is a real class: foam fighters under 450 g, a 10 m paper streamer and up to seven pilots in the sky. These are the next steps:",
    "ctaKits": "Kits (ef3m.pl)", "ctaGuide": "Build guide", "ctaTeams": "Squadrons and contests", "ctaRules": "Rules",
    "toast.full": "Room is full (7 boxes). Playing offline.", "toast.lost": "Connection lost, reconnecting...", "toast.back": "Reconnected", "toast.noReconnect": "Could not reconnect. Playing offline.",
    "toast.newFight": "New fight", "toast.copied": "Invite link copied: ", "toast.link": "Invite link: ",
    "easy": "Easy bots", "club": "Club bots", "ace": "Ace bots", "levelTip": "Skill of the bots you add",
    "o.toward": "toward you", "o.away": "away from you", "o.right": "to the right", "o.left": "to the left", "o.climb": "climbing", "o.dive": "diving", "o.nose": "Nose", "o.side": "Nose sideways", "o.upside": "upside down", "o.bankR": "banked right", "o.bankL": "banked left",
    "w.span": "Wingspan", "w.battery": "Battery", "w.propD": "Prop diameter", "w.propP": "Prop pitch", "w.ballast": "Ballast", "w.plane": "Plane", "w.video": "Video power", "w.race": "race mode", "w.auto": "Auto channel",
    "w.apply": "Apply and rejoin", "w.reset": "Reset", "w.adv": "Advanced physics…", "w.mass": "Mass", "w.legal": "Legal: counts for points.",
    "w.hint": "ESA limits: span 700-860 mm (§3.1.2), mass 200-450 g (§3.6.2), battery max 15 Wh (§3.4). An illegal plane still flies but scores 0 for the round (§6). The battery drains with throttle. A strong video transmitter reaches far but swamps other pilots' video when you fly near their box (sim effect, not an ESA rule).",
    "tipsT": "How to fly", "tipsOk": "Got it",
    "tip1": "Hold Shift for throttle (Ctrl lowers it), then press Space to throw the plane (hand launch, ESA §4.4).",
    "tip2": "W/S pitch (W = nose down), A/D roll, Q/E rudder. Small taps are small inputs.",
    "tip3": "The round dial top right shows where your nose points, as seen from your box.",
    "tip4": "Cut other streamers with the prop or the wing edge (+100). Never cross the red line (-200).",
    "tip5": "M mute, V analog FPV, R radio setup, P back to the pilot view.",
    "voiceOff": "Voice: off", "voicePtt": "Voice: hold T to talk", "voiceOpen": "Voice: open mic", "voiceErr": "No microphone (needs https or localhost, and permission)",
    "fov": "FOV", "fovTip": "Field of view of the pilot view", "fovFpv": "FPV FOV", "fovFpvTip": "Field of view of the FPV camera (separate from the pilot view)",
    "abort": "End match", "leave": "Leave", "abortAsk": "End the match for everybody and return to the waiting room? The running fight is not scored.",
    "w.aileron": "Aileron throw", "w.elevator": "Elevator throw", "w.rudder": "Rudder throw",
    "katoHint": "Flying wing: it has no stabiliser and dives hands-off. Hold S (stick back) after the throw and fly it with small inputs.",
    "round": "Round", "final": "Final",
    "ev.cut": "{a} cut {b}'s streamer  +{p}", "ev.safety": "{a} crossed the safety line  {p}", "ev.dq": "{a} disqualified: second crossing (§4.9)",
    "ev.warn": "Non-engagement warning: go fight (§4.14)", "ev.non": "{a} non-engagement  {p}", "ev.land": "{a} landed in the field  +{p}", "ev.prot": "{a} kept the streamer  +{p}",
    "ev.flight": "FLIGHT!", "ev.over": "Flight over: land now", "launched": "Launched", "notNow": "Not now: launch is allowed in the flight part (§4.2.3)", "launchedFull": "Launched at full throttle (Ctrl to reduce)", "vtxHand": "Change the video transmitter with the model in your hand", "replay": "Replay",
    "lang": "PL",
  },
  pl: {
    "t.lobby": "Poczekalnia", "s.lobby": "Dodaj boty albo poczekaj na pilotów, naciśnij Gotowy, potem Start. Loty treningowe są dozwolone (Spacja = start z ręki).",
    "t.prep": "Przygotowanie", "s.prep": "Loty próbne dozwolone (ESA §4.2.1). Naciśnij Gotowy, gdy jesteś gotów.",
    "t.ready": "Gotowość", "s.ready": "Modele zostają w boksach (§4.2.2). Lot zaczyna się na sygnał.",
    "t.flight": "LOT", "s.flight": "Tnij taśmy przeciwników (+100). Chroń własną. Nie przekraczaj linii bezpieczeństwa (-200).",
    "t.ended": "Koniec lotu: lądować", "s.ended": "Lądowanie na polu lądowania daje teraz +20 (§4.7).",
    "t.results": "Wyniki", "s.results": "Za chwilę nowa walka.",
    "contestOver": "Koniec zawodów. Zwycięzca: {name}, {pts} pkt.",
    "waitHost": "Czekamy aż {name} zacznie walkę. Naciśnij Gotowy, loty treningowe są dozwolone.", "theHost": "gospodarz",
    "th": ["Pilot", "czas", "cięcia", "linia", "walka", "suma"],
    "workshop": "Warsztat", "ready": "Gotowy", "invite": "Pokój prywatny", "inviteCopy": "Kopiuj link", "addBot": "Dodaj bota", "rmBots": "Usuń boty", "start": "Start walki",
    "planeTip": "Twój samolot (przeładuje stronę)", "inviteTip": "Otwórz pokój prywatny i skopiuj link z zaproszeniem",
    "watch": "Obejrzyj powtórkę", "stopReplay": "Zatrzymaj powtórkę", "saveReplay": "Zapisz powtórkę (JSON)",
    "battery": "akumulator", "batteryEmpty": "akumulator pusty!",
    "help": "Spacja start · WASD pochylenie/przechylenie · Q/E ster kierunku · Shift/Ctrl gaz · P widok pilota · V FPV · R aparatura · M dźwięk",
    "offlineT": "Trening offline", "offlineS": "Brak serwera: lataj swobodnie (Spacja = start z ręki). Do walk uruchom npm run server.",
    "vtxPow": "Moc nadajnika wideo (zmiana z modelem w ręku)", "vtxCh": "Kanał wideo",
    "lost": "BRAK SYGNAŁU", "interf": "ZAKŁÓCENIA", "ill": "NIEZGODNY",
    "ctaT": "Podobało się? Polataj naprawdę.",
    "ctaP": "ESA to prawdziwa klasa: piankowe myśliwce do 450 g, taśma papierowa 10 m i do siedmiu pilotów w powietrzu. Oto kolejne kroki:",
    "ctaKits": "Zestawy (ef3m.pl)", "ctaGuide": "Poradnik budowy", "ctaTeams": "Eskadry i zawody", "ctaRules": "Regulamin",
    "toast.full": "Pokój pełny (7 boksów). Gra offline.", "toast.lost": "Utracono połączenie, łączę ponownie...", "toast.back": "Połączono ponownie", "toast.noReconnect": "Nie udało się połączyć. Gra offline.",
    "toast.newFight": "Nowa walka", "toast.copied": "Skopiowano link: ", "toast.link": "Link: ",
    "easy": "Boty łatwe", "club": "Boty klubowe", "ace": "Boty asy", "levelTip": "Poziom dodawanych botów",
    "o.toward": "w Twoją stronę", "o.away": "od Ciebie", "o.right": "w prawo", "o.left": "w lewo", "o.climb": "wznosi się", "o.dive": "nurkuje", "o.nose": "Nos", "o.side": "Nos bokiem", "o.upside": "do góry kołami", "o.bankR": "przechył w prawo", "o.bankL": "przechył w lewo",
    "w.span": "Rozpiętość", "w.battery": "Akumulator", "w.propD": "Średnica śmigła", "w.propP": "Skok śmigła", "w.ballast": "Balast", "w.plane": "Samolot", "w.video": "Moc wideo", "w.race": "tryb race", "w.auto": "Kanał auto",
    "w.apply": "Zastosuj i dołącz ponownie", "w.reset": "Resetuj", "w.adv": "Zaawansowana fizyka…", "w.mass": "Masa", "w.legal": "Zgodny z przepisami: liczy się do punktów.",
    "w.hint": "Limity ESA: rozpiętość 700-860 mm (§3.1.2), masa 200-450 g (§3.6.2), akumulator maks. 15 Wh (§3.4). Niezgodny samolot lata, ale dostaje 0 pkt za rundę (§6). Akumulator rozładowuje się wraz z gazem. Mocny nadajnik wideo sięga daleko, ale zakłóca obraz innym pilotom, gdy lecisz blisko ich boksu (efekt symulatora, nie przepis ESA).",
    "tipsT": "Jak latać", "tipsOk": "Rozumiem",
    "tip1": "Przytrzymaj Shift dla gazu (Ctrl zmniejsza), potem Spacja rzuca samolot (start z ręki, ESA §4.4).",
    "tip2": "W/S wysokość (W = nos w dół), A/D przechylenie, Q/E ster kierunku. Krótkie stuknięcia to małe wychylenia.",
    "tip3": "Okrągły wskaźnik w prawym górnym rogu pokazuje, gdzie jest nos, widziany z Twojego boksu.",
    "tip4": "Tnij taśmy śmigłem albo krawędzią skrzydła (+100). Nie przekraczaj czerwonej linii (-200).",
    "tip5": "M dźwięk, V analogowe FPV, R ustawienia aparatury, P powrót do widoku pilota.",
    "voiceOff": "Głos: wyłączony", "voicePtt": "Głos: przytrzymaj T", "voiceOpen": "Głos: mikrofon otwarty", "voiceErr": "Brak mikrofonu (wymaga https lub localhost oraz zgody)",
    "fov": "FOV", "fovTip": "Pole widzenia widoku pilota", "fovFpv": "FOV FPV", "fovFpvTip": "Pole widzenia kamery FPV (osobno od widoku pilota)",
    "abort": "Zakończ mecz", "leave": "Wyjdź", "abortAsk": "Zakończyć mecz dla wszystkich i wrócić do poczekalni? Trwająca walka nie będzie liczona.",
    "w.aileron": "Wychylenie lotek", "w.elevator": "Wychylenie steru wys.", "w.rudder": "Wychylenie steru kier.",
    "katoHint": "Latające skrzydło: nie ma statecznika i bez sterowania nurkuje. Po rzucie przytrzymaj S (drążek do siebie) i leć małymi wychyleniami.",
    "round": "Runda", "final": "Finał",
    "ev.cut": "{a} uciął taśmę {b}  +{p}", "ev.safety": "{a} przekroczył linię bezpieczeństwa  {p}", "ev.dq": "{a} zdyskwalifikowany: drugie przekroczenie (§4.9)",
    "ev.warn": "Ostrzeżenie za unikanie walki: leć walczyć (§4.14)", "ev.non": "{a} unikanie walki  {p}", "ev.land": "{a} wylądował na polu  +{p}", "ev.prot": "{a} zachował taśmę  +{p}",
    "ev.flight": "LOT!", "ev.over": "Koniec lotu: lądować", "launched": "Wystartowano", "notNow": "Teraz nie: start jest dozwolony w części lotnej (§4.2.3)", "launchedFull": "Start na pełnym gazie (Ctrl zmniejsza)", "vtxHand": "Zmień nadajnik wideo z modelem w ręku", "replay": "Powtórka",
    "lang": "EN",
  },
};
const detect = () => {
  let s = new URLSearchParams(location.search).get("lang");
  if (!s) { try { s = localStorage.getItem("esasim-lang"); } catch {} }
  return /^pl/i.test(s || navigator.language || "en") ? "pl" : "en";
};
export const lang = detect();
export const t = (k, vars) => { let s = dict[lang][k] ?? dict.en[k] ?? k; if (vars && typeof s === "string") for (const [a, b] of Object.entries(vars)) s = s.replace("{" + a + "}", b); return s; };
export function toggleLang() {
  const next = lang === "pl" ? "en" : "pl";
  try { localStorage.setItem("esasim-lang", next); } catch {}
  const u = new URLSearchParams(location.search); u.set("lang", next); location.search = u.toString();
}
// Static page parts (the intro card): elements with data-i18n="key" take innerHTML from data-pl / data-en attributes' dictionary.
export function applyStatic() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-pl]")) if (lang === "pl") el.innerHTML = el.dataset.pl;
}
