// npm start: game server (:2567) and the Vite client (:5173) together. Ctrl+C stops both.
import { spawn } from "node:child_process";
const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit", env: process.env });
const procs = [run("node", ["server/index.js"]), run("npx", ["vite", "--host"])];
const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", stop));
console.log("\nESASIM: open http://localhost:5173 (LAN: use this machine's address, port 5173)\n");
