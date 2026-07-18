import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["fixtures/seat-limit-race/counterexample/**/*.test.ts"],
  },
});
