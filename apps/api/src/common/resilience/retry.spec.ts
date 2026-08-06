// ============================================
// retryWithBackoff tests
// ============================================
import { retryWithBackoff, defaultShouldRetry } from './retry';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    // Tests use real timers but tiny delays — we set Math.random to 0
    // so the jitter ceiling never matters.
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns immediately on first-attempt success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error then succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('ok');

    const result = await retryWithBackoff(fn, {
      baseDelayMs: 1,
      maxDelayMs: 1,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on non-transient errors (validation, 4xx)', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Bad Request'));

    await expect(retryWithBackoff(fn)).rejects.toThrow(/Bad Request/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects maxAttempts and throws the last error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('timeout'));

    await expect(
      retryWithBackoff(fn, { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 1 }),
    ).rejects.toThrow(/timeout/);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('calls onRetry hook with attempt number and delay', async () => {
    const onRetry = jest.fn();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('ok');

    await retryWithBackoff(fn, { baseDelayMs: 1, maxDelayMs: 1, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
  });

  it('lets the caller override shouldRetry to accept its own errors', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce('ok');

    const result = await retryWithBackoff(fn, {
      baseDelayMs: 1,
      maxDelayMs: 1,
      shouldRetry: (err) =>
        err instanceof Error && err.message.includes('rate limited'),
    });
    expect(result).toBe('ok');
  });

  describe('defaultShouldRetry', () => {
    it.each([
      'connection timeout',
      'ECONNREFUSED',
      'ECONNRESET',
      'socket hang up',
      'HTTP 503 service unavailable',
      '502 bad gateway',
    ])('returns true for "%s"', (msg) => {
      expect(defaultShouldRetry(new Error(msg))).toBe(true);
    });

    it.each([
      'invalid input',
      '400 bad request',
      'unauthorized',
      'foreign key constraint',
    ])('returns false for "%s"', (msg) => {
      expect(defaultShouldRetry(new Error(msg))).toBe(false);
    });

    it('returns false for non-Error values', () => {
      expect(defaultShouldRetry('string')).toBe(false);
      expect(defaultShouldRetry(null)).toBe(false);
      expect(defaultShouldRetry(undefined)).toBe(false);
    });
  });
});
