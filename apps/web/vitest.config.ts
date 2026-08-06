// ============================================
// Vitest — MVT config (Session S1 → extended in S2)
//
// Default environment stays `node` (pure-function specs: store, mappers,
// refresh-policy, middleware redirect). Component specs that need a DOM
// (RouteGuard / hooks, Session S2) opt in per-file with a docblock:
//
//     // @vitest-environment jsdom
//
// We use the per-file docblock rather than the deprecated
// `environmentMatchGlobs`. `jsdom` + React Testing Library are devDeps; the
// jest-dom matchers are registered globally in vitest.setup.ts (a no-op for
// node specs — it only calls expect.extend). The `@/` alias mirrors
// tsconfig.json paths so specs import the same way the app does.
// ============================================
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@web": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
  },
});
