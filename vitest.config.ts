import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    // Por enquanto so unit tests. Integration com DB vira em [QA-1.1].
    include: ["src/**/*.test.ts"],
    // Carrega .env apenas se existir (CI fornece via env: do workflow).
    setupFiles: ["./vitest.setup.ts"],
  },
});
