// Run: node test/vtx.test.js. Video link: range by power, interference from nearby transmitters.
import { Arena } from "../shared/arena.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";
import { signalQuality, interference, vtxRange, randomPower, VTX_POWERS, VTX_MAX_MW } from "../shared/vtx.js";

let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
check("close in the picture is clean", signalQuality(10, 25) === 1, "q=1 at 10 m, 25 mW");
check("25 mW is gone by 95 m, 100 mW (the maximum) reaches twice as far", signalQuality(100, 25) === 0 && signalQuality(100, 100) > 0.5 && vtxRange(100).lost > 180, `100 mW lost at ${vtxRange(100).lost.toFixed(0)} m`);
check("the allowed powers are 25, 50 and 100 mW only", VTX_POWERS.join() === "25,50,100" && Math.max(...VTX_POWERS) === VTX_MAX_MW, VTX_POWERS.join(", "));
check("quality falls with distance", signalQuality(40, 25) > signalQuality(60, 25) && signalQuality(60, 25) > signalQuality(80, 25), `${[40, 60, 80].map((d) => signalQuality(d, 25).toFixed(2)).join(" > ")}`);
const me = { mw: 25, ch: 2 };
check("alone: no interference", interference(me, 50, []).level === 0, "0");
check("equal power, same channel, other plane much closer to my box: heavy", interference(me, 50, [{ id: "x", mw: 25, ch: 2, d: 10 }]).level > 0.8, "level>0.8");
check("equal power, other channel 4 away, other plane close: moderate only", interference(me, 50, [{ id: "x", mw: 25, ch: 6, d: 10 }]).level < 0.5, `${interference(me, 50, [{ id: "x", mw: 25, ch: 6, d: 10 }]).level.toFixed(2)}`);
const strong = interference(me, 50, [{ id: "b", mw: 100, ch: 2, d: 10 }]);
check("a 100 mW pilot on my channel close to my box swamps a 25 mW link", strong.level > 0.9 && strong.source === "b", `level ${strong.level.toFixed(2)}, source ${strong.source}`);
check("the same pilot far away from my box is harmless", interference(me, 20, [{ id: "b", mw: 100, ch: 2, d: 150 }]).level < 0.5, `${interference(me, 20, [{ id: "b", mw: 100, ch: 2, d: 150 }]).level.toFixed(2)}`);
check("my own plane right at the box beats a 100 mW neighbour", interference(me, 3, [{ id: "n", mw: 100, ch: 3, d: 40 }]).level < 0.5, `${interference(me, 3, [{ id: "n", mw: 100, ch: 3, d: 40 }]).level.toFixed(2)}`);
check("random power: only 25, 50 and 100 mW, mostly race mode", (() => { let r = 0, ok = true; for (let i = 0; i < 1000; i++) { const p = randomPower(i / 1000); if (!VTX_POWERS.includes(p)) ok = false; if (p === 25) r++; } return ok && r > 400; })(), "45 % race mode");
// Switching the transmitter live (arena): allowed with the model in the hand, ignored in the air, bad values ignored.
{ const a = new Arena({ params: ESA_WWII }); const sl = a.addHuman("h", "H"); const before = { ...sl.vtx };
  a.setPose("h", { pos: [0, 1.4, -3], quat: [0, 0, 0, 1], airborne: false, held: true });
  check("pilot can switch power and channel in the hand", a.setVtx("h", { mw: 100, ch: 6 }) && sl.vtx.mw === 100 && sl.vtx.ch === 6, `${JSON.stringify(before)} -> ${JSON.stringify(sl.vtx)}`);
  a.step(1);                                                                      // time passes between reports (the server rejects teleports)
  a.setPose("h", { pos: [0, 10, 20], quat: [0, 0, 0, 1], airborne: true, held: false });
  check("no switching in the air", a.setVtx("h", { mw: 25, ch: 0 }) === false && sl.vtx.mw === 100, "ignored");
  a.setPose("h", { pos: [0, 1.4, -3], quat: [0, 0, 0, 1], airborne: false, held: true });
  a.setVtx("h", { mw: 5000, ch: 99 }); check("powers above the 100 mW maximum and bad channels are ignored", sl.vtx.mw === 100 && sl.vtx.ch === 6, JSON.stringify(sl.vtx)); }
process.exit(fail ? 1 : 0);
