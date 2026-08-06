// ============================================
// CircuitBreaker tests
// ============================================
import { ServiceUnavailableException } from '@nestjs/common';
import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test', { threshold: 3, cooldownMs: 100 });
  });

  it('starts CLOSED and passes calls through', async () => {
    expect(breaker.getState()).toBe('CLOSED');

    const result = await breaker.exec(async () => 'ok');
    expect(result).toBe('ok');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('stays CLOSED while failures are below threshold', async () => {
    for (let i = 0; i < 2; i++) {
      await expect(
        breaker.exec(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow();
    }
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('trips OPEN after threshold consecutive failures', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(
        breaker.exec(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow();
    }
    expect(breaker.getState()).toBe('OPEN');
  });

  it('fails FAST while OPEN (does not invoke fn)', async () => {
    // Trip it
    for (let i = 0; i < 3; i++) {
      await expect(breaker.exec(async () => { throw new Error('fail'); })).rejects.toThrow();
    }

    const fn = jest.fn();
    await expect(breaker.exec(fn)).rejects.toThrow(ServiceUnavailableException);
    expect(fn).not.toHaveBeenCalled();
  });

  it('moves to HALF_OPEN after cooldown elapses, then CLOSES on success', async () => {
    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await expect(breaker.exec(async () => { throw new Error('fail'); })).rejects.toThrow();
    }
    expect(breaker.getState()).toBe('OPEN');

    // Wait past cooldown (100ms)
    await new Promise((r) => setTimeout(r, 110));

    // A successful probe closes the breaker
    const result = await breaker.exec(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('failed probe in HALF_OPEN bounces back to OPEN', async () => {
    // Trip
    for (let i = 0; i < 3; i++) {
      await expect(breaker.exec(async () => { throw new Error('fail'); })).rejects.toThrow();
    }

    await new Promise((r) => setTimeout(r, 110));

    await expect(
      breaker.exec(async () => { throw new Error('still broken'); }),
    ).rejects.toThrow(/still broken/);

    expect(breaker.getState()).toBe('OPEN');
  });

  it('consecutive-failure counter resets after a success', async () => {
    await expect(breaker.exec(async () => { throw new Error('f'); })).rejects.toThrow();
    await expect(breaker.exec(async () => { throw new Error('f'); })).rejects.toThrow();
    await breaker.exec(async () => 'ok'); // resets counter

    // Need 3 MORE failures to trip
    await expect(breaker.exec(async () => { throw new Error('f'); })).rejects.toThrow();
    await expect(breaker.exec(async () => { throw new Error('f'); })).rejects.toThrow();
    expect(breaker.getState()).toBe('CLOSED');

    await expect(breaker.exec(async () => { throw new Error('f'); })).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');
  });
});
