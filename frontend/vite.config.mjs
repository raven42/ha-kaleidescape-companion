import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

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
  root: fileURLToPath(new URL(".", import.meta.url)),
  envPrefix: [],
  plugins: [runtimeBoundary()],
  build: {
    outDir: fileURLToPath(new URL("dist", import.meta.url)),
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL("src/ui/panel.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "panel.js",
    },
    rollupOptions: {
      output: { codeSplitting: false },
    },
  },
});
