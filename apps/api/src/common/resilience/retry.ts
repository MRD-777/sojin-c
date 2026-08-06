// ============================================
// retryWithBackoff — exponential backoff with full jitter
//
// Suitable for idempotent external calls (GET, PUT to a known key, etc.).
// DO NOT wrap raw POST calls — duplicates may be created on retry.
//
// Algorithm:
//   attempt N delay = min(maxDelayMs, baseDelayMs * 2^(N-1))
//   actual delay   = random(0, delay)   ← full jitter (AWS Architecture Blog)
//
// Reference: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
// ============================================

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3. */
  maxAttempts?: number;
  /** Initial delay in ms before the second attempt. Default: 300ms. */
  baseDelayMs?: number;
  /** Upper cap on per-attempt delay. Default: 5000ms. */
  maxDelayMs?: number;
  /**
   * Predicate: should we retry this specific error?
   * Default: retry on network/timeout/5xx-shaped errors only.
   */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Optional hook for observability — called before each retry. */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

/** Default retry policy — only on transient infrastructure errors. */
export const defaultShouldRetry = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();

  // Network/transient signatures we DO retry
  const transientPatterns = [
    'timeout',
    'timed out',
    'econnrefused',
    'econnreset',
    'enotfound',
    'socket hang up',
    'network',
    '503',
    '502',
    '504',
    'service unavailable',
    'bad gateway',
    'gateway timeout',
  ];
  return transientPatterns.some((p) => msg.includes(p));
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 300,
    maxDelayMs = 5000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt || !shouldRetry(err, attempt)) {
        throw err;
      }

      // Full jitter: random between 0 and the exponential ceiling
      const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const delay = Math.floor(Math.random() * ceiling);

      onRetry?.(err, attempt, delay);

      await sleep(delay);
    }
  }

  // Unreachable in normal flow — the loop either returns or throws.
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
