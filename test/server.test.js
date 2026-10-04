// Run: node test/server.test.js. Starts the server with short phases, connects real WebSocket clients and checks a fight.
import { spawn } from "node:child_process";
import { Client } from "@colyseus/sdk";

const PORT = 2599;
const srv = spawn("node", ["server/index.js"], { env: { ...process.env, PORT, ESASIM_PREP: "1", ESASIM_READY: "1", ESASIM_FLIGHT: "20" }, stdio: ["ignore", "pipe", "inherit"] });
let ready = false; srv.stdout.on("data", (d) => { if (String(d).includes("ESASIM server on")) ready = true; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
for (let i = 0; i < 50 && !ready; i++) await sleep(100);

const mk = async (name) => {
  const room = await new Client(`ws://localhost:${PORT}`).joinOrCreate("combat", { name });
  const st = { room, events: [], snap: null, you: null };
  room.onMessage("events", (e) => st.events.push(...e));
  room.onMessage("snap", (s) => { st.snap = s; });
  room.onMessage("you", (y) => { st.you = y; });
  return st;
};
const quat = [0, 0, 0, 1];                         // facing +z
const quatX = [0, Math.SQRT1_2, 0, Math.SQRT1_2];  // facing +x (rotation +90 deg about y)
try {
  const A = await mk("Alice"), B = await mk("Bob");
  await sleep(300);
  check("both joined, different boxes", A.you && B.you && A.you.pit !== B.you.pit, `${A.you?.pit} ${B.you?.pit}`);
  A.room.send("ready"); B.room.send("ready"); A.room.send("start");
  await sleep(2500);
  check("phase flight reached", A.snap?.fight.phase === "flight", A.snap?.fight.phase);

  // Scripted flights at 20 Hz. A flies along +z at 15 m/s, y = 10. B crosses A's streamer 5 m behind A's tail flying along +x.
  // B sweeps back and forth across the streamer while its distance behind A slowly changes, so the test does not depend on timer drift.
  let az = 12, k = 0;
  const iv = setInterval(() => {
    k++; az += 15 * 0.05;
    A.room.send("pose", { pos: [0, 10, az], quat, airborne: true, held: false });
    B.room.send("pose", { pos: [7 * Math.sin(k * 0.3), 10, az - 4.2 - 3 * Math.min(k / 50, 1)], quat: quatX, airborne: true, held: false });
  }, 50);
  await sleep(2500);
  clearInterval(iv);
  const cuts = [...A.events, ...B.events].filter((e) => e.type === "cut");
  check("a cut is scored when B crosses A's streamer", cuts.length >= 1 && cuts[0].pts === 100, `${cuts.length} cut events`);

  // Safety line: B flies at z=10 then at z=-1 -> -200.
  B.room.send("pose", { pos: [30, 10, 10], quat, airborne: true, held: false }); await sleep(150);
  B.room.send("pose", { pos: [30, 10, -1], quat, airborne: true, held: false }); await sleep(250);
  const sl = B.events.filter((e) => e.type === "safety");
  check("safety line crossing detected (-200)", sl.length >= 1 && sl[0].pts === -200, `${sl.length} events`);
  const me = B.snap.fight.pilots.find((p) => p.id === B.you.id);
  check("score = flight + cuts x 100 - 200 (§6)", me.score === me.flight + me.cuts * 100 - 200, `score ${me.score}, flight ${me.flight}, cuts ${me.cuts}`);
  const iv2 = setInterval(() => { az += 0.75; A.room.send("pose", { pos: [0, 10, az], quat, airborne: true, held: false }); }, 50);
  await sleep(3500); clearInterval(iv2);
  const a = A.snap.fight.pilots.find((p) => p.id === A.you.id);
  check("flight-time points accrue (+1 per 3 s, §6)", a.flight >= 1, `A flight ${a.flight}`);

  // Bots can be added only in the lobby and the arena survives them.
  await sleep(100);
  check("snapshots carry streamers", A.snap.planes.every((p) => p.streamer.length >= 6), `${A.snap.planes.length} planes`);
  A.room.leave(); B.room.leave();
} catch (e) { console.error(e); fail++; }
srv.kill();
process.exit(fail ? 1 : 0);
