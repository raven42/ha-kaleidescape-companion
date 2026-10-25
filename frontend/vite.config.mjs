import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { HA_TARGET, localExportGuard } from "./dev-proxy.mjs";

export default defineConfig({
  // Custom environment values must never become browser credentials.
  envPrefix: [],
  plugins: [localExportGuard()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: ["localhost"],
    cors: false,
    proxy: {
      "^/api/kaleidescape_companion/": { target: HA_TARGET, ws: false },
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
  build: {
    lib: {
      entry: fileURLToPath(new URL("src/panel.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "panel.js",
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
