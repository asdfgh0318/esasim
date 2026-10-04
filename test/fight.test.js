// Run: node test/fight.test.js. One check per scoring line of ESA §6 plus the flow rules.
import { Fight } from "../shared/fight.js";

let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
const air = (z = 20, x = 0) => ({ airborne: true, pos: [x, 10, z], streamerIntact: true });
const ground = (z = 5, x = 0, intact = true) => ({ airborne: false, pos: [x, 0.08, z], streamerIntact: intact });
function setup(cfg) {
  const f = new Fight({ prep: 5, ready: 2, ...cfg });
  f.addPilot("a", { bot: false }); f.addPilot("b", { bot: false });
  f.start(); f.setReady("a"); f.setReady("b");
  const run = (s, rep, dt = 0.1) => { for (let i = 0; i < Math.round(s / dt); i++) f.step(dt, rep(i * dt)); };
  return { f, run };
}
const get = (f, id) => f.pilots.get(id);

// Flow: prep -> ready -> flight -> ended; everyone ready skips the rest of the prep.
{ const { f, run } = setup(); run(0.3, () => ({})); check("phase prep -> ready when all ready (§4.2)", f.phase === "ready", f.phase);
  run(2.1, () => ({})); check("ready -> flight", f.phase === "flight", f.phase);
  run(300.2, () => ({})); check("flight ends after 300 s (§4.5)", f.phase === "ended" || f.phase === "results", f.phase); }
{ const f = new Fight(); f.addPilot("a"); f.start(); check("needs at least 2 pilots (§4.1)", f.phase === "lobby", f.phase); }
{ const f = new Fight(); for (let i = 0; i < 8; i++) f.addPilot("p" + i); check("max 7 pilots (§4.1)", f.pilots.size === 7, `${f.pilots.size}`); }

// Flight points: +1 per 3 s, capped at 100 (§6).
{ const { f, run } = setup(); run(2.5, () => ({}));
  run(150, () => ({ a: air(), b: ground() })); check("flight time points 150 s = 50", f.flightPoints(get(f, "a")) === 50, `${f.flightPoints(get(f, "a"))}`);
  run(149.5, () => ({ a: air(), b: ground() })); check("flight time points capped at 100", f.flightPoints(get(f, "a")) === 100, `${f.flightPoints(get(f, "a"))}`); }

// Cut +100, one attack = one cut (§4.11), attacker must be flying.
{ const { f, run } = setup(); run(2.5, () => ({ a: air(), b: air(25) }));
  const c1 = f.cut("a", "b"), c2 = f.cut("a", "b"); run(3, () => ({ a: air(), b: air(25) })); const c3 = f.cut("a", "b");
  check("cut +100, same attack counts once", c1 && !c2 && get(f, "a").cuts === 2 && c3, `cuts=${get(f, "a").cuts}`);
  run(1, () => ({ a: ground(), b: air(25) })); check("grounded attacker scores no cut", f.cut("a", "b") === false, "no cut"); }

// Safety line (§4.9): launch from the pilot line is fine; crossing back = -200; second = disqualified, keeps points.
{ const { f, run } = setup(); run(2.5, () => ({}));
  run(1, () => ({ a: air(-2.5), b: ground() })); check("launch from the pilot line is not a crossing", get(f, "a").crossings === 0, "0");
  run(1, () => ({ a: air(10), b: ground() })); run(1, () => ({ a: air(-1), b: ground() }));
  check("first crossing -200", get(f, "a").crossings === 1 && !get(f, "a").disqualified, `crossings=${get(f, "a").crossings}`);
  run(1, () => ({ a: air(10), b: ground() })); run(1, () => ({ a: air(-1), b: ground() }));
  check("second crossing: disqualified", get(f, "a").crossings === 2 && get(f, "a").disqualified, `dq=${get(f, "a").disqualified}`);
  check("score includes -400", f.score(get(f, "a")) <= -400 + f.flightPoints(get(f, "a")), `${f.score(get(f, "a"))}`); }

// Protection +50 needs >= 10 s airborne and an intact streamer (§4.10); a cut loses it.
{ const { f, run } = setup({ flight: 60 }); run(2.5, () => ({}));
  run(60.5, () => ({ a: air(), b: air(25) })); run(2, () => ({ a: ground(8), b: ground(8, 3) }));
  const pa = get(f, "a"), pb = get(f, "b");
  check("protection bonus +50 when intact and flown >= 10 s", f.phase === "results" && pa.protectionBonus === 50 && pb.protectionBonus === 50, `a=${pa.protectionBonus} b=${pb.protectionBonus}`); }
{ const { f, run } = setup({ flight: 60 }); run(2.5, () => ({}));
  run(10, () => ({ a: air(), b: air(25) })); f.cut("a", "b"); run(50.5, () => ({ a: air(), b: air(25) })); run(2, () => ({ a: ground(8), b: ground(8, 3, false) }));
  check("cut victim loses protection", get(f, "b").protectionBonus === 0 && get(f, "a").protectionBonus === 50, `a=${get(f, "a").protectionBonus} b=${get(f, "b").protectionBonus}`); }

// Landing bonus +20 (§6, §4.7): after the end signal, in the 50 x 20 m field, last launch >= 10 s before the end.
{ const { f, run } = setup({ flight: 60 }); run(2.5, () => ({}));
  run(0.2, () => ({ a: air(), b: air(25) })); run(60.5, () => ({ a: air(), b: air(25) }));
  run(0.5, () => ({ a: ground(10, 5), b: ground(30, 0) }));
  check("landing in the field after the end: +20", get(f, "a").landingBonus === 20, `a=${get(f, "a").landingBonus}`);
  check("landing outside the field: no bonus", get(f, "b").landingBonus === 0, `b=${get(f, "b").landingBonus}`); }
{ const { f, run } = setup({ flight: 60 }); run(2.5, () => ({}));
  run(51, () => ({ a: ground(), b: air(25) })); run(9.3, () => ({ a: air(), b: air(25) })); run(0.5, () => ({ a: air(), b: air(25) }));
  run(0.5, () => ({ a: ground(10), b: ground(10, 5) }));
  check("launch less than 10 s before the end: no bonus", get(f, "a").landingBonus === 0, `a=${get(f, "a").landingBonus}`); }

// Non-engagement (§4.14): warning after 30 s away, -50 after 30 s more.
{ const { f, run } = setup(); run(2.5, () => ({}));
  run(31, () => ({ a: air(20, -60), b: air(20, 60) })); const w = get(f, "a").warned;
  run(31, () => ({ a: air(20, -60), b: air(20, 60) }));
  check("warning at 30 s, -50 after 30 s more", w && get(f, "a").nonEngagements >= 1, `warned=${w}, penalties=${get(f, "a").nonEngagements}`); }
{ const { f, run } = setup(); run(2.5, () => ({}));
  run(70, () => ({ a: air(20, 0), b: air(20, 10) }));
  check("no penalty when fighting", get(f, "a").nonEngagements === 0, `${get(f, "a").nonEngagements}`); }
process.exit(fail ? 1 : 0);
