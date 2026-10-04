// Small synthesized sounds (no audio files): the whistle that starts and ends the flight part (ESA §4.2.3 one long signal),
// a rip when a streamer is cut, a buzzer for a safety line crossing, and a quiet motor tone that follows the throttle. M mutes.
// The AudioContext is created on the first key press or click (browsers require a user gesture).
let ctx = null, muted = false, motor = null;
try { muted = localStorage.getItem("esasim-mute") === "1"; } catch { /* no storage */ }
const ensure = () => {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
};
addEventListener("keydown", (e) => {
  ensure();
  if (e.code === "KeyM") { muted = !muted; try { localStorage.setItem("esasim-mute", muted ? "1" : "0"); } catch { /* ignore */ } if (motor) motor.gain.gain.value = 0; }
});
addEventListener("pointerdown", ensure);

function tone(freq, dur, type = "sine", vol = 0.12, slideTo = null) {
  const c = ctx; if (!c || muted) return;
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, vol = 0.15) {
  const c = ctx; if (!c || muted) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 2500; g.gain.value = vol; s.buffer = buf; s.connect(f).connect(g).connect(c.destination); s.start();
}

export const sound = {
  whistle() { if (!ensure()) return; tone(2900, 1.1, "square", 0.05); tone(3050, 1.1, "square", 0.04); },
  cut() { if (!ensure()) return; noise(0.35, 0.22); tone(900, 0.25, "sawtooth", 0.05, 200); },
  buzzer() { if (!ensure()) return; tone(140, 0.6, "sawtooth", 0.08); },
  // own motor: call every frame with the throttle (0..1) and whether the plane is flying
  motor(throttle, on) {
    const c = ensure(); if (!c) return;
    if (!motor) { const o = c.createOscillator(), g = c.createGain(); o.type = "sawtooth"; o.frequency.value = 120; g.gain.value = 0; o.connect(g).connect(c.destination); o.start(); motor = { osc: o, gain: g }; }
    motor.osc.frequency.setTargetAtTime(110 + throttle * 260, c.currentTime, 0.1);
    motor.gain.gain.setTargetAtTime(on && !muted ? 0.012 + throttle * 0.02 : 0, c.currentTime, 0.1);
  },
};
