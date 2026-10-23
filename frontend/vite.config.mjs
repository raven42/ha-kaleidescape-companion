import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
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
