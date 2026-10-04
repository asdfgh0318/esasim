// Run: node test/vtx.test.js. Video link: range by power, interference from nearby transmitters.
import { Arena } from "../shared/arena.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";
import { signalQuality, interference, vtxRange, randomPower } from "../shared/vtx.js";

let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
check("close in the picture is clean", signalQuality(10, 25) === 1, "q=1 at 10 m, 25 mW");
check("25 mW is gone by 95 m, 5 W reaches much further", signalQuality(100, 25) === 0 && signalQuality(100, 5000) > 0.9 && vtxRange(5000).lost > 1000, `5 W lost at ${vtxRange(5000).lost.toFixed(0)} m`);
check("quality falls with distance", signalQuality(40, 25) > signalQuality(60, 25) && signalQuality(60, 25) > signalQuality(80, 25), `${[40, 60, 80].map((d) => signalQuality(d, 25).toFixed(2)).join(" > ")}`);
const me = { mw: 25, ch: 2 };
check("alone: no interference", interference(me, 50, []).level === 0, "0");
check("equal power, same channel, other plane much closer to my box: heavy", interference(me, 50, [{ id: "x", mw: 25, ch: 2, d: 10 }]).level > 0.8, "level>0.8");
check("equal power, other channel 4 away, other plane close: moderate only", interference(me, 50, [{ id: "x", mw: 25, ch: 6, d: 10 }]).level < 0.5, `${interference(me, 50, [{ id: "x", mw: 25, ch: 6, d: 10 }]).level.toFixed(2)}`);
const blaster = interference(me, 50, [{ id: "b", mw: 5000, ch: 6, d: 10 }]);
check("a 5 W blaster on a far channel still swamps a 25 mW link", blaster.level > 0.8 && blaster.source === "b", `level ${blaster.level.toFixed(2)}, source ${blaster.source}`);
check("the same blaster far away from my box is harmless", interference(me, 20, [{ id: "b", mw: 5000, ch: 6, d: 150 }]).level < 0.15, `${interference(me, 20, [{ id: "b", mw: 5000, ch: 6, d: 150 }]).level.toFixed(2)}`);
check("my own plane right at the box beats a 200 mW neighbour", interference(me, 3, [{ id: "n", mw: 200, ch: 3, d: 40 }]).level < 0.5, `${interference(me, 3, [{ id: "n", mw: 200, ch: 3, d: 40 }]).level.toFixed(2)}`);
check("random power: some blasters, mostly race mode", (() => { let b = 0, r = 0; for (let i = 0; i < 1000; i++) { const p = randomPower(i / 1000); if (p === 5000) b++; if (p === 25) r++; } return b > 80 && b < 180 && r > 400; })(), "about 13 % blasters, 45 % race mode");
// Switching the transmitter live (arena): allowed with the model in the hand, ignored in the air, bad values ignored.
{ const a = new Arena({ params: ESA_WWII }); const sl = a.addHuman("h", "H"); const before = { ...sl.vtx };
  a.setPose("h", { pos: [0, 1.4, -3], quat: [0, 0, 0, 1], airborne: false, held: true });
  check("pilot can switch power and channel in the hand", a.setVtx("h", { mw: 5000, ch: 6 }) && sl.vtx.mw === 5000 && sl.vtx.ch === 6, `${JSON.stringify(before)} -> ${JSON.stringify(sl.vtx)}`);
  a.setPose("h", { pos: [0, 10, 20], quat: [0, 0, 0, 1], airborne: true, held: false });
  check("no switching in the air", a.setVtx("h", { mw: 25, ch: 0 }) === false && sl.vtx.mw === 5000, "ignored");
  a.setPose("h", { pos: [0, 1.4, -3], quat: [0, 0, 0, 1], airborne: false, held: true });
  a.setVtx("h", { mw: 777, ch: 99 }); check("invalid values are ignored", sl.vtx.mw === 5000 && sl.vtx.ch === 6, JSON.stringify(sl.vtx)); }
process.exit(fail ? 1 : 0);
