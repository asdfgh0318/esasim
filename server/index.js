import { defineServer, defineRoom, Room } from "colyseus";
import { Arena } from "../shared/arena.js";
import { ESA_WWII } from "../shared/planes/esa-wwii.js";
import { FIGHT } from "../shared/rules.js";

// One fight room (ESA §4.1: up to 7 pilots). Clients fly their own plane and report the pose; the arena judges
// (streamers, cuts, safety line, scoring) and simulates the bots. Phase lengths can be shortened with env vars for tests.
const env = (k, d) => (process.env[k] ? Number(process.env[k]) : d);
const TICK = 1 / 30, SEND_EVERY = 2, RESULTS_SECONDS = 20;

class CombatRoom extends Room {
  maxClients = FIGHT.maxPilots;

  onCreate() {
    this.arena = new Arena({ rounds: env("ESASIM_ROUNDS", 3), params: ESA_WWII, fight: { prep: env("ESASIM_PREP", FIGHT.prepSeconds), ready: env("ESASIM_READY", 10), flight: env("ESASIM_FLIGHT", FIGHT.flightSeconds) } });
    this.tick = 0; this.resultsAt = null;
    this.onMessage("pose", (c, m) => this.arena.setPose(c.sessionId, m));
    this.onMessage("ready", (c, v) => this.arena.fight.setReady(c.sessionId, v !== false));
    this.onMessage("addBot", () => { if (this.arena.fight.phase === "lobby") this.arena.addBot("Bot " + (this.arena.slots.size + 1)); });
    this.onMessage("removeBots", () => { if (this.arena.fight.phase === "lobby") for (const s of [...this.arena.slots.values()]) if (s.bot) this.arena.remove(s.id); });
    this.onMessage("start", () => this.arena.fight.start());
    this.setSimulationInterval(() => this.update(), 1000 * TICK);
  }

  update() {
    const events = this.arena.step(TICK);
    for (const e of events) if (e.type === "phase" && e.phase === "results") this.resultsAt = this.arena.t;
    if (events.length) this.broadcast("events", events);
    if (this.arena.fight.phase === "results" && this.resultsAt !== null && this.arena.t - this.resultsAt > RESULTS_SECONDS) { this.arena.restart(); this.resultsAt = null; this.broadcast("restart", {}); }
    if (++this.tick % SEND_EVERY === 0) this.broadcast("snap", this.arena.snapshot());
  }

  onJoin(client, options) {
    const s = this.arena.addHuman(client.sessionId, String(options?.name || "Pilot").slice(0, 16), String(options?.plane || "spitfire"));
    client.send("you", { id: client.sessionId, pit: s ? s.pit : 0 });
    console.log(client.sessionId, "joined, box", s ? s.pit + 1 : "?");
  }
  onLeave(client) { this.arena.remove(client.sessionId); }
}

const server = defineServer({ rooms: { combat: defineRoom(CombatRoom) } });
const port = Number(process.env.PORT) || 2567;
server.listen(port).then(() => console.log(`ESASIM server on :${port}`));
