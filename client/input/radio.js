// Radio (RadioMaster etc.) input via the Gamepad API: channel mapping, invert, calibration, save/load.
// Ported from symulator_fpv (src/systems/input/GamepadController.js + InputManager.js + main.js calibration).
// Differences from the drone sim: plane channels (AETR), no FPV rate curves (the radio does its own rates and expo),
// and the stick centre is captured at rest instead of from the last samples.
export const CHANNELS = ["aileron", "elevator", "throttle", "rudder"];
const KEY = "esasim_radio_config";

const defaults = () => ({
  mapping: [0, 1, 2, 3],                 // gamepad axis index per channel (AETR, change in the panel)
  inverted: [false, false, false, false],
  calibration: {},                       // axisIdx -> { min, max, center }
  deadband: 0.02,
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
    this.raw = [];
    this.id = null;
    this.channels = { aileron: 0, elevator: 0, throttle: 0, rudder: 0 }; // aileron/rudder/elevator -1..1, throttle 0..1
    this.calibrating = false;
    this._cal = {};
    this._restFrames = 0;
    this.load();
  }

  get connected() { return this.id !== null; }

  poll() {
    const pad = [...(navigator.getGamepads?.() ?? [])].find((g) => g && g.axes.length >= 4);
    if (!pad) { this.id = null; this.raw = []; return false; }
    this.id = pad.id;
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

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.config)); return true; } catch { return false; } }
  load() {
    try { const s = localStorage.getItem(KEY); if (s) this.config = { ...defaults(), ...JSON.parse(s) }; } catch { /* no storage */ }
  }
  reset() { this.config = defaults(); }
  applyPreset(name) { const p = PRESETS[name]; if (p) { this.config.mapping = [...p.mapping]; this.config.inverted = [...p.inverted]; this.config.calibration = {}; } }
}
