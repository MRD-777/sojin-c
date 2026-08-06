// ============================================
// Circuit breaker — protects external services from request floods
// when they're already struggling.
//
// States:
//   CLOSED       — normal operation, all calls go through
//   OPEN         — too many failures; FAIL FAST without calling
//   HALF_OPEN    — cooldown expired, allow ONE probe; if it succeeds, close
//
// Why we need this:
//   Without a breaker, a flaky Supabase = every request waits 30s for a
//   timeout. We'd exhaust the connection pool in seconds. The breaker
//   short-circuits to a clear error after `threshold` failures, giving
//   the downstream service room to recover.
//
// Usage:
//   const breaker = new CircuitBreaker('supabase-auth', { threshold: 5, cooldownMs: 30_000 });
//   await breaker.exec(() => supabase.auth.signInWithPassword(...));
//
// Note: breakers are PROCESS-LOCAL. In a multi-instance deployment, each
// instance has its own state. For coordinated breaking, use a Redis-backed
// implementation later.
// ============================================
import { Logger, ServiceUnavailableException } from '@nestjs/common';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Consecutive failures before tripping OPEN. */
  threshold?: number;
  /** Time in OPEN state before allowing a probe. */
  cooldownMs?: number;
  /** Custom message returned to the caller when OPEN. */
  openMessage?: string;
}

export class CircuitBreaker {
  private readonly logger: Logger;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly openMessage: string;

  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt = 0;

  constructor(
    public readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.threshold = options.threshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.openMessage =
      options.openMessage ?? `الخدمة "${name}" غير متاحة مؤقتاً — حاول بعد قليل`;
    this.logger = new Logger(`Breaker:${name}`);
  }

  /** Current state — exposed for observability/tests. */
  getState(): CircuitState {
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Has the cooldown elapsed? If yes, allow ONE probe (HALF_OPEN).
      if (Date.now() - this.openedAt >= this.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.logger.log('Cooldown elapsed — moving to HALF_OPEN');
      } else {
        throw new ServiceUnavailableException(this.openMessage);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.logger.log('Probe succeeded — closing circuit');
    }
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
  }

  private onFailure(err: unknown): void {
    this.consecutiveFailures += 1;

    if (this.state === 'HALF_OPEN') {
      // The probe call failed — bounce back to OPEN immediately
      this.openedAt = Date.now();
      this.state = 'OPEN';
      this.logger.warn(
        `Probe failed — circuit back to OPEN (cooldown ${this.cooldownMs}ms)`,
      );
      return;
    }

    if (
      this.state === 'CLOSED' &&
      this.consecutiveFailures >= this.threshold
    ) {
      this.openedAt = Date.now();
      this.state = 'OPEN';
      this.logger.error(
        `Circuit OPEN after ${this.consecutiveFailures} consecutive failures. ` +
          `Last error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Test-only: reset to CLOSED. */
  reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.openedAt = 0;
  }
}
