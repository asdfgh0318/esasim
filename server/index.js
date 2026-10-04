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
  onJoin(client) { console.log(client.sessionId, "joined"); }
  onLeave(client) { delete this.poses[client.sessionId]; }
}

const server = defineServer({ rooms: { combat: defineRoom(CombatRoom) } });
const port = Number(process.env.PORT) || 2567;
server.listen(port).then(() => console.log(`ESASIM server on :${port}`));
