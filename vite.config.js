import { defineConfig } from "vite";

// Dev server: reachable from the LAN and through tunnels (host names are not filtered). Build: both pages (game and model viewer).
export default defineConfig({
  server: { host: true, allowedHosts: true },
  build: { rollupOptions: { input: { main: "index.html", viewer: "viewer.html" } } },
});
