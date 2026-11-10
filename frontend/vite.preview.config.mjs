/** Loopback-only development preview; never imported by the production build. */
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { HA_TARGET, localApiGuard } from "./dev/proxy.mjs";

export default defineConfig({
  root: fileURLToPath(new URL("dev", import.meta.url)),
  envPrefix: [],
  plugins: [localApiGuard()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: ["localhost"],
    cors: false,
    proxy: {
      "^/api/(kaleidescape_companion/|media_player_proxy/)": {
        target: HA_TARGET,
        ws: false,
      },
    },
    fs: {
      strict: true,
      allow: [fileURLToPath(new URL(".", import.meta.url))],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: ["localhost"],
    cors: false,
  },
});
