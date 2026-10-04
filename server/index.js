import { defineServer, defineRoom, Room } from "colyseus";
import { FIGHT } from "../shared/rules.js";

// Skeleton: relays poses at 20 Hz. Rule enforcement (safety line, scoring, phases) comes next.
class CombatRoom extends Room {
  maxClients = FIGHT.maxPilots; // §4.1

  onCreate() {
    this.poses = {};
    this.onMessage("pose", (client, p) => { this.poses[client.sessionId] = p; });
    this.setSimulationInterval(() => this.broadcast("poses", this.poses), 50);
  }
  // One plane per start pit, first free pit (Fig 1, §4.1: up to 7 pilots).
  onJoin(client) {
    this.pits ??= {};
    const taken = new Set(Object.values(this.pits));
    let pit = 0; while (taken.has(pit)) pit++;
    this.pits[client.sessionId] = pit;
    client.send("pit", pit);
    console.log(client.sessionId, "joined, pit", pit + 1);
  }
  onLeave(client) { delete this.poses[client.sessionId]; delete this.pits[client.sessionId]; }
}

const server = defineServer({ rooms: { combat: defineRoom(CombatRoom) } });
const port = Number(process.env.PORT) || 2567;
server.listen(port).then(() => console.log(`ESASIM server on :${port}`));
