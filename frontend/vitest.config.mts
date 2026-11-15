import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { conditions: ["browser"] },
  test: {
    environment: "happy-dom",
    // Rendering large library pages is CPU intensive; bound concurrent workers.
    maxWorkers: 4,
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
