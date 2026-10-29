import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { HA_TARGET, localApiGuard } from "./dev/proxy.mjs";

const developmentDirectories = ["dev/", "tests/"].map((path) =>
  fileURLToPath(new URL(path, import.meta.url)),
);

/** Fail the production build if its module graph reaches preview code or fixtures. */
function runtimeBoundary() {
  return {
    name: "kaleidescape-runtime-boundary",
    apply: "build",
    generateBundle() {
      for (const module of this.getModuleIds()) {
        if (
          developmentDirectories.some((directory) =>
            module.startsWith(directory),
          )
        )
          this.error(
            "The HA panel must not import development modules or test fixtures",
          );
      }
    },
  };
}

export default defineConfig({
  // Custom environment values must never become browser credentials.
  root: fileURLToPath(new URL("dev", import.meta.url)),
  envPrefix: [],
  plugins: [localApiGuard(), runtimeBoundary()],
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
  build: {
    outDir: fileURLToPath(new URL("dist", import.meta.url)),
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL("src/ui/panel.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "panel.js",
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
