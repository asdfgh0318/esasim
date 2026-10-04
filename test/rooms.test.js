// Run: node test/rooms.test.js. Private room codes, host-only controls, reconnect to the same box, "room full" (real WebSocket clients).
import { spawn } from "node:child_process";
import { Client } from "@colyseus/sdk";

const PORT = 2598;
const srv = spawn("node", ["server/index.js"], { env: { ...process.env, PORT, ESASIM_PREP: "30", ESASIM_READY: "5", ESASIM_FLIGHT: "20" }, stdio: ["ignore", "pipe", "inherit"] });
let ready = false; srv.stdout.on("data", (d) => { if (String(d).includes("ESASIM server on")) ready = true; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fail++; };
for (let i = 0; i < 50 && !ready; i++) await sleep(100);

const join = async (pid, code, name = pid) => {
  const room = await new Client(`ws://localhost:${PORT}`).joinOrCreate("combat", { name, pid, code });
  const st = { room, snap: null, you: null, full: false };
  room.onMessage("snap", (s) => { st.snap = s; }); room.onMessage("restart", () => {}); room.onMessage("you", (y) => { st.you = y; }); room.onMessage("full", () => { st.full = true; }); room.onMessage("ping", (n) => room.send("pong", n));
  return st;
};
try {
  const A = await join("alice", "ROOM1"), B = await join("bob", "ROOM1"), C = await join("carol", "ROOM2");
  await sleep(400);
  check("room codes keep rooms apart", A.snap.fight.pilots.length === 2 && C.snap.fight.pilots.length === 1, `ROOM1=${A.snap.fight.pilots.length} ROOM2=${C.snap.fight.pilots.length}`);
  check("the first human is the host", A.snap.host === A.you.id && B.snap.host === A.you.id, `host=${A.snap.host}`);
  B.room.send("addBot"); B.room.send("start"); await sleep(300);
  check("a non-host cannot add bots or start", B.snap.fight.pilots.length === 2 && B.snap.fight.phase === "lobby", `${B.snap.fight.pilots.length} pilots, ${B.snap.fight.phase}`);
  A.room.send("addBot"); await sleep(300);
  check("the host can add a bot", A.snap.fight.pilots.length === 3, `${A.snap.fight.pilots.length}`);

  // Reconnect: Bob's socket drops without a deliberate leave; coming back with the same pid gives the same box and no new pilot.
  const pitBefore = B.you.pit; B.room.connection.close(3999);   // any code except the deliberate-leave code 4000
  await sleep(600);
  check("a dropped pilot keeps the slot for a while", A.snap.fight.pilots.length === 3, `${A.snap.fight.pilots.length} pilots`);
  const B2 = await join("bob", "ROOM1"); await sleep(400);
  check("reconnecting gives the same box and no extra pilot", B2.you.pit === pitBefore && A.snap.fight.pilots.length === 3, `pit ${pitBefore} -> ${B2.you.pit}, ${A.snap.fight.pilots.length} pilots`);

  // Full: 3 + 4 bots = 7, the next human gets "full" instead of a ghost slot.
  for (let i = 0; i < 4; i++) A.room.send("addBot"); await sleep(400);
  const D = await join("dave", "ROOM1"); await sleep(600);
  check("a human with no free box is told the room is full", A.snap.fight.pilots.length === 7 && D.full, `${A.snap.fight.pilots.length} pilots, full=${D.full}`);

  // Voice signalling: "rtc" goes only to the addressed pilot of the same room; oversized payloads are dropped.
  { const got = { A: [], B: [], C: [] }; A.room.onMessage("rtc", (m) => got.A.push(m)); B2.room.onMessage("rtc", (m) => got.B.push(m));
    const Cc = await join("carol2", "ROOM2"); Cc.room.onMessage("rtc", (m) => got.C.push(m)); await sleep(300);
    const aid = A.you.id, bid = B2.you.id;
    A.room.send("rtc", { to: bid, data: { join: true } }); A.room.send("rtc", { to: bid, data: { blob: "x".repeat(20000) } }); A.room.send("rtc", { to: Cc.you.id, data: { join: true } }); await sleep(400);
    check("rtc signalling reaches only the addressed pilot", got.B.length === 1 && got.B[0].from === aid && got.C.length === 0 && got.A.length === 0, `B=${got.B.length} C=${got.C.length} A=${got.A.length}`); }

  // End match (issue #18): only the host can abort a running fight; everybody returns to the waiting room.
  { A.room.send("start"); await sleep(400); const running = A.snap.fight.phase !== "lobby";
    B2.room.send("abort"); await sleep(300); const stillRunning = A.snap.fight.phase !== "lobby";
    A.room.send("abort"); await sleep(500);
    check("only the host can end a running match, which returns to the lobby", running && stillRunning && A.snap.fight.phase === "lobby", `running=${running} afterGuest=${stillRunning} afterHost=${A.snap.fight.phase}`); }

  // A deliberate leave frees the box at once.
  B2.room.leave(); await sleep(500);
  check("a deliberate leave frees the box", A.snap.fight.pilots.length === 6, `${A.snap.fight.pilots.length}`);
} catch (e) { console.log("FAIL exception", e); fail++; }
srv.kill();
process.exit(fail ? 1 : 0);
