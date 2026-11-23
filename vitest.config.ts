import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "scripts/**/*.test.mjs"],
    environment: "node",
    setupFiles: ["./src/test/setup-env.ts"],
    server: { deps: { inline: [/next-auth/, /^next\//] } },
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/db.ts", "src/lib/auth/config.ts"],
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 60 },
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
})
