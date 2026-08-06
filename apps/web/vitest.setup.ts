// ============================================
// Vitest global setup — jest-dom matchers
//
// This import only calls expect.extend(...) to register matchers like
// toBeInTheDocument(); it does NOT touch `document`, so it is a safe no-op for
// the node-environment pure specs. Component specs (jsdom) get the matchers
// for free. RTL's auto-cleanup runs per jsdom spec via the docblock env.
// ============================================
import "@testing-library/jest-dom/vitest";
