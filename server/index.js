import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { defineServer, defineRoom, Room } from "colyseus";
import { Arena } from "../shared/arena.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";
import { FIGHT } from "../shared/rules.js";

// One fight room (ESA §4.1: up to 7 pilots). Clients fly their own plane and report the pose; the arena judges
// (streamers, cuts, safety line, scoring) and simulates the bots. Phase lengths can be shortened with env vars for tests.
const env = (k, d) => (process.env[k] ? Number(process.env[k]) : d);
const TICK = 1 / 30, SEND_EVERY = 2, RESULTS_SECONDS = 20, RECONNECT_SECONDS = 30, EMPTY_ROOM_SECONDS = 120;
const PING_EVERY = 1;                          // seconds between round-trip measurements (lag-compensated cuts, docs/netcode.md)
const CONSENTED = 4000;                       // Colyseus close code for a deliberate leave
const cleanPid = (v, fallback) => "p-" + (String(v || fallback).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || fallback);

class CombatRoom extends Room {
  maxClients = 2 * FIGHT.maxPilots;               // sockets; the 7 start boxes (§4.1) are enforced by the arena, spare sockets get a "room full" message
  autoDispose = false;                            // a dropped player has 30 s to come back, so the room is closed by hand when it stays empty

  onCreate(options) {
    this.code = String(options?.code || "");
    this.sockets = new Map(); this.pending = new Map(); this.buildKeys = new Map(); this.emptyFor = 0;
    this.arena = new Arena({ strict: !!options?.strict, rounds: env("ESASIM_ROUNDS", 3), params: ESA_WWII, fight: { prep: env("ESASIM_PREP", FIGHT.prepSeconds), ready: env("ESASIM_READY", 10), flight: env("ESASIM_FLIGHT", FIGHT.flightSeconds) } });
    this.tick = 0; this.resultsAt = null;
    const pid = (c) => c.userData?.pid;
    const isHost = (c) => pid(c) === this.hostId();                                // only the host starts the fight and manages bots
    this.onMessage("pose", (c, m) => this.arena.setPose(pid(c), m));
    // Round trip measured by the server on its own clock: it sends "ping" n, the client echoes "pong" n. A client can only make its
    // round trip look longer (by answering late), and the arena clamps the resulting rewind (LAG.MAX_VIEW_DELAY in shared/arena.js).
    this.onMessage("pong", (c, n) => {
      const u = c.userData; if (!u || !u.ping || n !== u.ping.n) return;
      const rtt = (performance.now() - u.ping.at) / 1000; u.ping = null;
      u.rtt = u.rtt == null ? rtt : u.rtt * 0.8 + rtt * 0.2;                          // smoothed (EWMA); the first sample is taken as is
      this.arena.setRtt(u.pid, u.rtt);
    });
    this.onMessage("vtx", (c, m) => this.arena.setVtx(pid(c), m));
    this.onMessage("ready", (c, v) => this.arena.fight.setReady(pid(c), v !== false));
    const LEVELS = { easy: 0.3, club: 0.7, ace: 0.95 };                              // bot skill: stick noise and lead aim
    this.onMessage("addBot", (c, m) => { if (isHost(c) && this.arena.fight.phase === "lobby") this.arena.addBot("Bot " + (this.arena.slots.size + 1), undefined, LEVELS[m?.level] ?? 0.7); });
    this.onMessage("removeBots", (c) => { if (isHost(c) && this.arena.fight.phase === "lobby") for (const s of [...this.arena.slots.values()]) if (s.bot) this.arena.remove(s.id); });
    this.onMessage("start", (c) => { if (isHost(c)) this.arena.fight.start(); });
    this.onMessage("abort", (c) => { if (isHost(c) && this.arena.fight.phase !== "lobby") { this.arena.restart(); this.resultsAt = null; this.broadcast("restart", {}); } });   // host ends the match: back to the lobby, the aborted fight is not scored
    // Voice chat signalling only: the audio itself goes peer to peer (WebRTC). The server relays small handshake messages between two pilots of this room.
    this.onMessage("rtc", (c, m) => {
      if (!m || typeof m.to !== "string" || JSON.stringify(m.data ?? null).length > 12000) return;
      const target = this.clients.find((o) => o.userData?.pid === m.to);
      if (target && target !== c) target.send("rtc", { from: pid(c), data: m.data });
    });
    this.setSimulationInterval(() => this.update(), 1000 * TICK);
  }

  hostId() { for (const s of this.arena.slots.values()) if (!s.bot) return s.id; return null; }   // the longest-present human

  update() {
    const humans = [...this.arena.slots.values()].filter((s) => !s.bot).length;
    this.emptyFor = humans ? 0 : this.emptyFor + TICK;
    if (this.emptyFor > EMPTY_ROOM_SECONDS) { this.disconnect(); return; }
    const events = this.arena.step(TICK);
    for (const e of events) if (e.type === "phase" && e.phase === "results") this.resultsAt = this.arena.t;
    if (events.length) this.broadcast("events", events);
    if (this.arena.fight.phase === "results" && this.resultsAt !== null && this.arena.t - this.resultsAt > RESULTS_SECONDS) { this.arena.restart(); this.resultsAt = null; this.broadcast("restart", {}); }
    if (++this.tick % SEND_EVERY === 0) this.broadcast("snap", { ...this.arena.snapshot(), host: this.hostId() });
    if (this.tick % Math.round(PING_EVERY / TICK) === 0) for (const c of this.clients) {
      const u = c.userData; if (!u) continue;
      u.pingN = (u.pingN || 0) + 1; u.ping = { n: u.pingN, at: performance.now() };      // an unanswered ping is simply replaced (no penalty, no change)
      c.send("ping", u.pingN);
    }
  }

  // A pilot is identified by a stable id kept in the browser (`pid`), not by the socket, so a dropped player (or a page reload) takes the
  // same start box and keeps the contest score when coming back within RECONNECT_SECONDS.
  onJoin(client, options) {
    const id = cleanPid(options?.pid, client.sessionId);
    client.userData = { pid: id };
    clearTimeout(this.pending.get(id)); this.pending.delete(id);
    this.sockets.set(id, client.sessionId);
    let s = this.arena.slots.get(id);
    if (s && s.bot) s = null;
    const key = JSON.stringify([options?.plane, options?.build]);
    if (s && this.buildKeys.get(id) !== key && this.arena.fight.phase === "lobby") { this.arena.remove(id); s = null; }   // plane or build changed (page reload) before the fight: new model, same pilot
    this.buildKeys.set(id, key);
    if (!s) s = this.arena.addHuman(id, String(options?.name || "Pilot").slice(0, 16), String(options?.plane || "spitfire"), options?.build);
    if (!s) { this.sockets.delete(id); client.send("full", {}); setTimeout(() => client.leave(), 300); return; }   // all 7 start boxes taken (humans and bots share them, §4.1)
    client.send("you", { id, pit: s.pit });
    console.log(id, "joined, box", s.pit + 1, this.code ? `room ${this.code}` : "");
  }
  onLeave(client, code) {
    const id = client.userData?.pid;
    if (!id || this.sockets.get(id) !== client.sessionId) return;                // an old socket that was already replaced by a rejoin
    this.sockets.delete(id);
    if (code === CONSENTED) { this.arena.remove(id); return; }
    this.pending.set(id, setTimeout(() => { this.pending.delete(id); if (!this.sockets.has(id)) this.arena.remove(id); }, RECONNECT_SECONDS * 1000));
  }
}

// One port for everything: if the client is built (`npm run build`, or `npm run play`), this server also serves it, so a friend only
// needs http://<your-address>:2567 and no second port or tunnel. In development `npm start` serves the client with Vite instead.
const dist = fileURLToPath(new URL("../dist", import.meta.url));
const server = defineServer({
  transport: new WebSocketTransport({ maxPayload: 64 * 1024 }),                       // the default 4 kB could cut a voice-chat handshake (SDP with ICE candidates)
  rooms: { combat: defineRoom(CombatRoom).filterBy(["code"]) },                // ?room=CODE = a private room; no code = the shared default room
  express: (app) => { if (existsSync(dist)) { app.use(express.static(dist)); console.log("serving the built client from dist/"); } },
});
const port = Number(process.env.PORT) || 2567;
server.listen(port).then(() => console.log(`ESASIM server on :${port}`));
