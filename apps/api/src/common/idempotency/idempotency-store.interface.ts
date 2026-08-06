// ============================================
// Idempotency store contract
//
// Abstracted so we can swap the backing implementation later:
//   - InMemoryIdempotencyStore (default, single-instance)
//   - RedisIdempotencyStore   (multi-instance, persistence)
//
// The cached record contains the response status + body so we can replay
// the EXACT response on a duplicate call. We also store a fingerprint of
// the request body — if the client re-uses the same key with a DIFFERENT
// body, that's almost certainly a bug and we return 422.
// ============================================

export interface IdempotencyRecord {
  /** HTTP status of the original response. */
  statusCode: number;
  /** Response body (already JSON-serializable). */
  body: unknown;
  /** SHA-256 hex of the request payload, for fingerprint mismatch detection. */
  requestFingerprint: string;
  /** ISO timestamp when the record was created. */
  createdAt: string;
}

export interface IdempotencyStore {
  /**
   * Get a previously stored response for this (tenant, key) pair, or null.
   * Implementations may evict by TTL.
   */
  get(tenantId: string, key: string): Promise<IdempotencyRecord | null>;

  /**
   * Persist a response. Implementations MUST be atomic — i.e., two
   * concurrent set() calls for the same key must not interleave.
   * TTL is in seconds; recommended 24h for financial endpoints.
   */
  set(
    tenantId: string,
    key: string,
    record: IdempotencyRecord,
    ttlSeconds: number,
  ): Promise<void>;

  /**
   * Reserve a key as "in flight" so concurrent duplicates block on this one.
   * Returns true if reserved, false if another request already reserved it.
   *
   * In-memory implementation uses a Map of Promise — concurrent callers
   * await the same promise and get the same result.
   * Redis implementation uses SETNX.
   */
  reserve?(tenantId: string, key: string): Promise<boolean>;
}
