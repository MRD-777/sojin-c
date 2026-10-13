// ============================================
// MVT-1 — the new Supabase key format must pass env validation.
//
// Supabase replaced legacy JWT keys (eyJ…) with `sb_secret_…`. Nothing in
// env-validation inspects the key's shape, so the new format should pass —
// but "should" is not evidence. This pins it.
//
// Deliberately a separate file from env-validation.spec.ts: that suite is
// red (TEST-BASELINE-001, 8 failures on throw-message wording), and a new
// guarantee must not be buried inside a failing suite.
// ============================================
import { Logger } from '@nestjs/common';
import { validateEnvironment } from './env-validation';

const KEY = 'SUPABASE_SERVICE_ROLE_KEY';

describe('validateEnvironment — Supabase sb_secret_ key format (MVT-1)', () => {
  const originalEnv = { ...process.env };
  let errorLines: string[];

  beforeEach(() => {
    errorLines = [];
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((msg: unknown) => void errorLines.push(String(msg)));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    process.env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      NEXT_PUBLIC_SUPABASE_URL: 'https://stub.supabase.co',
      // The shape this whole spec exists for. Assembled at runtime so no
      // full-length key-shaped literal ever sits in source — a literal here
      // would be a false positive for any repo-wide secret scan, and a bad
      // pattern to set.
      [KEY]: `sb_secret_${'A'.repeat(31)}`,
      JWT_SECRET: 'a'.repeat(64),
      COOKIE_SECRET: 'b'.repeat(64),
    };
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts an sb_secret_ key: no throw, and no complaint naming the key', () => {
    expect(() => validateEnvironment()).not.toThrow();
    expect(errorLines.join('\n')).not.toContain(KEY);
  });

  // Paired assertion (rule #4). "No complaint about the key" is worthless if
  // the function cannot complain at all. Removing an UNRELATED variable must
  // still produce an error — and that error must still not name the key.
  // Without this, a vacuous no-op implementation would pass the test above.
  it('still reports other problems while accepting the key (proves it is not vacuous)', () => {
    delete process.env.DATABASE_URL;

    expect(() => validateEnvironment()).toThrow();

    const joined = errorLines.join('\n');
    expect(joined).toContain('[DATABASE_URL]');
    expect(joined).not.toContain(KEY);
  });

  // A legacy eyJ… key must ALSO pass: the absence of format checking is the
  // documented behaviour, and if someone adds shape validation later it has
  // to be a conscious decision that breaks this spec rather than a silent one.
  it('is format-agnostic: a legacy eyJ-style value passes too', () => {
    process.env[KEY] = `${'eyJ'}hbGciOiJIUzI1NiJ9.${'stub'}.${'stub'}`;
    expect(() => validateEnvironment()).not.toThrow();
    expect(errorLines.join('\n')).not.toContain(KEY);
  });

  it('rejects a missing key (the only rule that exists for it)', () => {
    delete process.env[KEY];
    expect(() => validateEnvironment()).toThrow();
    expect(errorLines.join('\n')).toContain(`[${KEY}]`);
  });
});
