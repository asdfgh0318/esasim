// Radio (RadioMaster etc.) input via the Gamepad API: channel mapping, invert, calibration, save/load.
// Ported from symulator_fpv (src/systems/input/GamepadController.js + InputManager.js + main.js calibration).
// Differences from the drone sim: plane channels (AETR), no FPV rate curves (the radio does its own rates and expo),
// and the stick centre is captured at rest instead of from the last samples.
export const CHANNELS = ["aileron", "elevator", "throttle", "rudder"];
// Several windows on one machine (two pilots, two controllers): ?pad=N makes a window use gamepad number N only (or the first gamepad whose name contains N
// when it is not a number), ?preset=radiomaster|gamepad applies a mapping preset when that window has no saved config yet. Each ?pad window keeps its own
// calibration and mapping in localStorage, so two controllers never overwrite each other. Without ?pad the first gamepad with 4 axes is used as before.
const Q = new URLSearchParams(location.search), PAD = Q.get("pad");
const CHOICE_KEY = "esasim_radio_choice";                    // the radio picked in the panel (its full gamepad name), kept in this browser profile
const slug = (s) => s.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);

const defaults = () => ({
  mapping: [0, 1, 2, 3],                 // gamepad axis index per channel (AETR, change in the panel)
  inverted: [false, false, false, false],
  calibration: {},                       // axisIdx -> { min, max, center }
  deadband: 0,                           // no deadband on the sticks (Adam, 2026-10-05); the radio's own centre calibration is still applied
});

// Mapping presets. "radiomaster": AETR on axes 0-3 (the radio in joystick mode). "gamepad": Xbox/PlayStation style pad, mode 2 sticks:
// right stick = aileron + elevator, left stick = throttle (up) + rudder. A spring-centred pad throttle rests at half, so a radio is much nicer.
export const PRESETS = {
  radiomaster: { label: "RadioMaster / AETR", mapping: [0, 1, 2, 3], inverted: [false, false, false, false] },
  gamepad: { label: "Gamepad (mode 2)", mapping: [2, 3, 1, 0], inverted: [false, false, true, false] },
};

export class RadioInput {
  constructor() {
    this.config = defaults();
    this.choice = null;                       // a radio picked from the list in the panel; ignored when the window has ?pad=
    try { if (PAD === null) this.choice = localStorage.getItem(CHOICE_KEY) || null; } catch { /* no storage */ }
    this.raw = [];
    this.id = null;
    this.channels = { aileron: 0, elevator: 0, throttle: 0, rudder: 0 }; // aileron/rudder/elevator -1..1, throttle 0..1
    this.calibrating = false;
    this._cal = {};
    this._restFrames = 0;
    this.load();
  }

  get connected() { return this.id !== null; }
  // each radio keeps its own calibration and mapping: a ?pad window by its number, a picked radio by its name, otherwise the shared default
  get key() { return "esasim_radio_config" + (PAD !== null ? "_pad" + PAD : this.choice ? "_" + slug(this.choice) : ""); }
  get pinned() { return PAD !== null; }
  listPads() { return [...(navigator.getGamepads?.() ?? [])].filter((g) => g && g.axes.length >= 4).map((g) => ({ index: g.index, id: g.id })); }
  selectPad(id) {                                  // null = automatic (the first radio)
    if (PAD !== null) return;
    this.choice = id || null;
    try { if (id) localStorage.setItem(CHOICE_KEY, id); else localStorage.removeItem(CHOICE_KEY); } catch { /* no storage */ }
    this.config = defaults(); this.calibrating = false; this.load();
  }

  poll() {
    const pads = [...(navigator.getGamepads?.() ?? [])].filter((g) => g && g.axes.length >= 4);
    const pad = PAD === null ? (this.choice ? pads.find((g) => g.id === this.choice) : pads[0]) : /^\d+$/.test(PAD) ? pads.find((g) => g.index === Number(PAD)) : pads.find((g) => g.id.toLowerCase().includes(PAD.toLowerCase()));
    if (!pad) { this.id = null; this.raw = []; return false; }
    this.id = pad.id; this.index = pad.index;
    this.raw = [...pad.axes];
    if (this.calibrating) this._track();
    CHANNELS.forEach((ch, i) => { this.channels[ch] = this._channel(i); });
    return true;
  }

  _channel(i) {
    const axis = this.config.mapping[i];
    const v = this.raw[axis] ?? 0;
    const cal = this.config.calibration[axis];
    const isThrottle = CHANNELS[i] === "throttle";
    let out;
    if (isThrottle) {
      out = cal && cal.max - cal.min > 0.1 ? (v - cal.min) / (cal.max - cal.min) : (v + 1) / 2;
      out = Math.min(1, Math.max(0, out));
      return this.config.inverted[i] ? 1 - out : out;
    }
    if (cal && cal.max - cal.min > 0.1) {
      const c = cal.center;
      out = v >= c ? (v - c) / Math.max(cal.max - c, 0.05) : (v - c) / Math.max(c - cal.min, 0.05);
    } else out = v;
    out = Math.min(1, Math.max(-1, out));
    if (Math.abs(out) < this.config.deadband) out = 0;
    return this.config.inverted[i] ? -out : out;
  }

  // Calibration: hold the sticks at rest for ~0.5 s (centre is averaged from those frames), then move
  // every stick to all extremes and stop.
  startCalibration() {
    this.calibrating = true; this._restFrames = 0; this._cal = {};
    this.raw.forEach((v, i) => { this._cal[i] = { min: v, max: v, sum: 0, n: 0 }; });
  }

  _track() {
    this._restFrames++;
    this.raw.forEach((v, i) => {
      const c = (this._cal[i] ??= { min: v, max: v, sum: 0, n: 0 });
      c.min = Math.min(c.min, v); c.max = Math.max(c.max, v);
      if (this._restFrames <= 30) { c.sum += v; c.n++; }
    });
  }

  stopCalibration() {
    this.calibrating = false;
    for (const [i, c] of Object.entries(this._cal)) {
      this.config.calibration[i] = { min: c.min, max: c.max, center: c.n ? c.sum / c.n : (c.min + c.max) / 2 };
    }
  }

  save() { try { localStorage.setItem(this.key, JSON.stringify(this.config)); return true; } catch { return false; } }
  load() {
    try { const s = localStorage.getItem(this.key); this._hadSaved = !!s; if (s) this.config = { ...defaults(), ...JSON.parse(s) }; } catch { /* no storage */ }
    if (!this._hadSaved && Q.get("preset")) this.applyPreset(Q.get("preset"));
    this.config.deadband = 0;               // an older saved config may still carry the former 0.02: it is ignored
  }
  reset() { this.config = defaults(); }
  applyPreset(name) { const p = PRESETS[name]; if (p) { this.config.mapping = [...p.mapping]; this.config.inverted = [...p.inverted]; this.config.calibration = {}; } }
}
