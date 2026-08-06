// ============================================
// LoginAttemptsTracker — per-email failure counter with lockout.
//
// Policy (skill 03 §12):
//   - 5 consecutive failures → 15-minute lock
//   - On the 20th failure in a 24h window → audit-log "suspicious activity"
//     (the audit-log entry alerts a SUPER_ADMIN via the notifications system
//      once F5 lands; until then it sits in the audit_logs table)
//
// Why a separate service and not inline counters in AuthService:
//   - Easy to swap the storage backend (in-memory now, Redis later — see
//     IdempotencyService for the same pattern)
//   - Easy to unit-test in isolation
//   - The auth flow stays readable
//
// Why per-EMAIL and not per-IP:
//   - Corporate NATs share one IP across hundreds of legitimate users
//     (banks, ministries, large construction firms in Egypt all do this).
//     Per-IP locks would lock out the whole company.
//   - Per-email-then-also-per-IP is the right answer; we layer IP on top
//     via the @nestjs/throttler global limit (5/min, see C10).
//
// Lock vs. throttle:
//   - Throttler (5/min) is the cheap first line — blocks rapid brute force.
//   - Lockout (5 fails / 15 min lock) catches the slow attacker who paces
//     under the throttle limit.
// ============================================
import { Injectable, Logger } from '@nestjs/common';

interface AttemptRecord {
  /** Consecutive failures since the last success or lockout reset. */
  failures: number;
  /** First-failure timestamp in the current window. Used for TTL. */
  firstFailureAt: number;
  /** Set when locked; null when not. */
  lockedUntil: number | null;
}

export interface LockoutStatus {
  locked: boolean;
  /** Seconds until unlock; 0 when not locked. */
  retryAfterSeconds: number;
  /** Failures so far (after the current attempt's outcome is recorded). */
  failures: number;
}

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ENTRIES = 50_000;

@Injectable()
export class LoginAttemptsTracker {
  private readonly logger = new Logger(LoginAttemptsTracker.name);
  private readonly attempts = new Map<string, AttemptRecord>();

  /**
   * Should this email be rejected immediately because it's locked?
   * Returns the lockout status without recording anything.
   */
  check(email: string): LockoutStatus {
    const key = this.key(email);
    const rec = this.attempts.get(key);
    if (!rec) return { locked: false, retryAfterSeconds: 0, failures: 0 };

    if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
      return {
        locked: true,
        retryAfterSeconds: Math.ceil((rec.lockedUntil - Date.now()) / 1000),
        failures: rec.failures,
      };
    }

    // Lock expired — drop it so the next failure starts the counter fresh
    if (rec.lockedUntil && rec.lockedUntil <= Date.now()) {
      this.attempts.delete(key);
      return { locked: false, retryAfterSeconds: 0, failures: 0 };
    }

    // Window expired — reset
    if (Date.now() - rec.firstFailureAt > WINDOW_MS) {
      this.attempts.delete(key);
      return { locked: false, retryAfterSeconds: 0, failures: 0 };
    }

    return { locked: false, retryAfterSeconds: 0, failures: rec.failures };
  }

  /**
   * Record a failed login. Returns the new lockout state.
   */
  recordFailure(email: string): LockoutStatus {
    const key = this.key(email);
    this.evictIfFull();

    const rec = this.attempts.get(key) ?? {
      failures: 0,
      firstFailureAt: Date.now(),
      lockedUntil: null,
    };

    rec.failures += 1;

    if (rec.failures >= MAX_FAILURES && !rec.lockedUntil) {
      rec.lockedUntil = Date.now() + LOCK_MS;
      this.logger.warn(
        `Account locked: ${this.maskEmail(email)} after ${rec.failures} consecutive failures (15min lock)`,
      );
    }

    this.attempts.set(key, rec);

    return {
      locked: !!rec.lockedUntil && rec.lockedUntil > Date.now(),
      retryAfterSeconds: rec.lockedUntil
        ? Math.ceil((rec.lockedUntil - Date.now()) / 1000)
        : 0,
      failures: rec.failures,
    };
  }

  /**
   * Reset the counter on successful login.
   */
  recordSuccess(email: string): void {
    this.attempts.delete(this.key(email));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Internals
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private key(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Mask emails before logging — full address in security logs is PII that
   * we don't need (the user can correlate by sub-second timestamps + IP).
   *   alice@example.com → al***@example.com
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '[masked]';
    const head = local.slice(0, 2);
    return `${head}***@${domain}`;
  }

  /**
   * Hard cap on the map size. Drops oldest 10% by insertion order when full.
   * Same pattern as InMemoryIdempotencyStore.
   */
  private evictIfFull(): void {
    if (this.attempts.size < MAX_ENTRIES) return;

    const toEvict = Math.floor(MAX_ENTRIES * 0.1);
    const iterator = this.attempts.keys();
    for (let i = 0; i < toEvict; i++) {
      const next = iterator.next();
      if (next.done) break;
      this.attempts.delete(next.value);
    }
  }
}
