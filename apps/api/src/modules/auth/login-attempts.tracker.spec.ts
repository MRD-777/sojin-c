// ============================================
// LoginAttemptsTracker tests
// ============================================
import { LoginAttemptsTracker } from './login-attempts.tracker';

describe('LoginAttemptsTracker', () => {
  let tracker: LoginAttemptsTracker;

  beforeEach(() => {
    tracker = new LoginAttemptsTracker();
  });

  describe('check()', () => {
    it('returns not-locked / 0 failures for a fresh email', () => {
      const status = tracker.check('alice@test.com');
      expect(status).toEqual({
        locked: false,
        retryAfterSeconds: 0,
        failures: 0,
      });
    });

    it('treats email case-insensitively', () => {
      tracker.recordFailure('Alice@Test.com');
      expect(tracker.check('alice@test.com').failures).toBe(1);
      expect(tracker.check('ALICE@TEST.COM').failures).toBe(1);
    });
  });

  describe('recordFailure() + lockout threshold', () => {
    it('counts up to 4 failures without locking', () => {
      const email = 'alice@test.com';
      for (let i = 1; i <= 4; i++) {
        const r = tracker.recordFailure(email);
        expect(r.locked).toBe(false);
        expect(r.failures).toBe(i);
      }
    });

    it('locks on the 5th consecutive failure', () => {
      const email = 'alice@test.com';
      for (let i = 1; i < 5; i++) tracker.recordFailure(email);

      const r = tracker.recordFailure(email);
      expect(r.locked).toBe(true);
      expect(r.failures).toBe(5);
      // 15 minutes = 900 seconds, allow a few-second drift
      expect(r.retryAfterSeconds).toBeGreaterThan(890);
      expect(r.retryAfterSeconds).toBeLessThanOrEqual(900);
    });

    it('check() reports locked while the lock window is active', () => {
      const email = 'alice@test.com';
      for (let i = 0; i < 5; i++) tracker.recordFailure(email);

      const status = tracker.check(email);
      expect(status.locked).toBe(true);
    });

    it('subsequent failures while locked DO NOT extend the lock', () => {
      const email = 'alice@test.com';
      for (let i = 0; i < 5; i++) tracker.recordFailure(email);

      const first = tracker.check(email).retryAfterSeconds;
      tracker.recordFailure(email);
      tracker.recordFailure(email);
      const second = tracker.check(email).retryAfterSeconds;

      // Lock time shouldn't grow on additional failures within the window
      expect(second).toBeLessThanOrEqual(first);
    });
  });

  describe('recordSuccess()', () => {
    it('clears the failure counter on successful login', () => {
      const email = 'alice@test.com';
      tracker.recordFailure(email);
      tracker.recordFailure(email);
      expect(tracker.check(email).failures).toBe(2);

      tracker.recordSuccess(email);
      expect(tracker.check(email).failures).toBe(0);
    });

    it('post-success, the counter needs another 5 failures to lock', () => {
      const email = 'alice@test.com';
      for (let i = 0; i < 4; i++) tracker.recordFailure(email);
      tracker.recordSuccess(email);

      for (let i = 0; i < 4; i++) {
        const r = tracker.recordFailure(email);
        expect(r.locked).toBe(false);
      }
      const fifth = tracker.recordFailure(email);
      expect(fifth.locked).toBe(true);
    });
  });

  describe('lock expiry', () => {
    it('check() returns not-locked AFTER the lock window passes', () => {
      const email = 'alice@test.com';
      for (let i = 0; i < 5; i++) tracker.recordFailure(email);

      // Reach into the internal map and rewind the lock by 16 minutes
      // (simulating the lock window having expired)
      const map = (tracker as unknown as { attempts: Map<string, { lockedUntil: number }> })
        .attempts;
      const rec = map.get(email);
      if (rec) rec.lockedUntil = Date.now() - 60_000;

      const status = tracker.check(email);
      expect(status.locked).toBe(false);
      expect(status.failures).toBe(0); // record was dropped
    });
  });

  describe('isolation between users', () => {
    it('locks one email without affecting another', () => {
      for (let i = 0; i < 5; i++) tracker.recordFailure('alice@test.com');

      expect(tracker.check('alice@test.com').locked).toBe(true);
      expect(tracker.check('bob@test.com').locked).toBe(false);
    });
  });
});
