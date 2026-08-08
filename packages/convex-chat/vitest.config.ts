import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: [
        "src/component/conversations.ts",
        "src/component/limits.ts",
        "src/component/messages.ts",
        "src/component/model.ts",
        "src/component/presence.ts",
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 75,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
    environment: "edge-runtime",
  },
});
