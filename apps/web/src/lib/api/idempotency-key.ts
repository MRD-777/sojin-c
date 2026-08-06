// ============================================
// idempotency-key — client-generated keys for money-moving actions (S4)
//
// The backend requires an `Idempotency-Key` header on POST /updates/:id/approve
// and /force-cancel (validated server-side against ^[A-Za-z0-9_-]{16,64}$; see
// apps/api/.../idempotency-key.decorator.ts). If the client regenerated the key
// on every render/retry, the backend would treat each send as a NEW operation
// → phase.progress incremented twice / SUNK_COST payment created twice. So the
// key MUST be generated ONCE per logical user action and reused for its whole
// lifetime (including any retry).
//
// This module is deliberately React-free so the stability contract is testable
// in the vitest `node` env (page/hook render tests are still infra-blocked —
// WEB-S1-004). The consumer (the confirm Dialog) holds one holder instance in a
// useRef, passes holder.current() to the mutation, and calls holder.reset()
// after a successful action so the next action starts a fresh key.
// ============================================

/** Same contract the backend enforces (idempotency-key.decorator.ts:19). */
const SAFE_KEY = /^[A-Za-z0-9_-]{16,64}$/;

/** True when `key` satisfies the backend's Idempotency-Key format. */
export function isValidIdempotencyKey(key: string): boolean {
  return SAFE_KEY.test(key);
}

/**
 * Generate a fresh opaque key. Prefers crypto.randomUUID (36-char UUID v4),
 * falls back to hex from getRandomValues (48 chars — still within 16–64). Both
 * outputs match SAFE_KEY. Throws rather than emit a weak/colliding key if no
 * Web Crypto is available (never silently degrade an idempotency guarantee).
 */
export function generateIdempotencyKey(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(24));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  throw new Error(
    "Web Crypto unavailable — cannot generate an Idempotency-Key. " +
      "Refusing to emit a weak key for a money-moving action.",
  );
}

/** A lazily-generated, resettable single key — one per logical action. */
export interface IdempotencyKeyHolder {
  /** The key for THIS action. Generated on first call, cached thereafter. */
  current(): string;
  /** Drop the cached key so the next current() starts a fresh action. */
  reset(): void;
}

/**
 * Create a holder whose current() returns the SAME key until reset() is called.
 * This is the deepest representable form of the stability contract (rule #4):
 * not "the key looks valid" but "the exact key is stable across re-invocation".
 */
export function createIdempotencyKeyHolder(): IdempotencyKeyHolder {
  let key: string | null = null;
  return {
    current() {
      if (key === null) key = generateIdempotencyKey();
      return key;
    },
    reset() {
      key = null;
    },
  };
}
