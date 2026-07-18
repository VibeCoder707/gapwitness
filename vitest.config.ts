import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "fixtures/**/tests/**/*.test.ts"],
    exclude: ["fixtures/**/counterexample/**", "node_modules/**", "e2e/**"],
    coverage: { reporter: ["text", "json-summary"] },
  },
});
