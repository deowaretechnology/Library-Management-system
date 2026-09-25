import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Integration tests share one real (in-memory) database — run them one at a time
    // so they don't race each other's writes.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
