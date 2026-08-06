// ============================================
// validateEnvironment tests
//
// We toggle process.env inside each test and restore afterwards. NEVER use
// jest.replaceProperty here — env vars are global side-effects, and we want
// to make damn sure prod-required vars aren't accidentally left out.
// ============================================
import { validateEnvironment } from './env-validation';

describe('validateEnvironment', () => {
  // Snapshot the env once and restore after every test
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean slate — set the minimum-valid environment, then individual
    // tests override what they want to test.
    process.env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      NEXT_PUBLIC_SUPABASE_URL: 'https://stub.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'sk_stub_xxxxxxxxxxxxxxxxxxxxx',
      JWT_SECRET: 'a'.repeat(64),
      COOKIE_SECRET: 'b'.repeat(64),
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('passes with a fully-configured environment', () => {
    expect(() => validateEnvironment()).not.toThrow();
  });

  describe('DATABASE_URL', () => {
    it('throws when missing', () => {
      delete process.env.DATABASE_URL;
      expect(() => validateEnvironment()).toThrow(/DATABASE_URL/);
    });

    it('throws when not a postgres URL', () => {
      process.env.DATABASE_URL = 'mysql://...';
      expect(() => validateEnvironment()).toThrow(/postgresql/);
    });

    it('accepts both postgresql:// and postgres:// schemes', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@host:5432/db';
      expect(() => validateEnvironment()).not.toThrow();
    });
  });

  describe('JWT_SECRET (I4)', () => {
    it('throws when missing', () => {
      delete process.env.JWT_SECRET;
      expect(() => validateEnvironment()).toThrow(/JWT_SECRET/);
    });

    it('throws when too short', () => {
      process.env.JWT_SECRET = 'short';
      expect(() => validateEnvironment()).toThrow(/too short/);
    });

    it('throws on placeholder values', () => {
      process.env.JWT_SECRET = 'your-secret-here-' + 'x'.repeat(50);
      expect(() => validateEnvironment()).toThrow(/placeholder/);
    });

    it.each(['change-me-' + 'x'.repeat(60), 'CHANGEME' + 'x'.repeat(60), 'todo-' + 'x'.repeat(60)])(
      'detects common placeholder pattern: %s',
      (val) => {
        process.env.JWT_SECRET = val;
        expect(() => validateEnvironment()).toThrow(/placeholder/);
      },
    );
  });

  describe('Supabase', () => {
    it('throws when NEXT_PUBLIC_SUPABASE_URL missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(() => validateEnvironment()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    });

    it('throws when SUPABASE_SERVICE_ROLE_KEY missing', () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(() => validateEnvironment()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('throws when URL is not a valid URL', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'not a url';
      expect(() => validateEnvironment()).toThrow(/Not a valid URL/);
    });
  });

  describe('Production-only requirements', () => {
    it('requires CORS_ALLOWED_ORIGINS in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ALLOWED_ORIGINS;
      expect(() => validateEnvironment()).toThrow(/CORS_ALLOWED_ORIGINS/);
    });

    it('accepts dev without CORS_ALLOWED_ORIGINS', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.CORS_ALLOWED_ORIGINS;
      expect(() => validateEnvironment()).not.toThrow();
    });

    it('requires COOKIE_SECRET in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.COOKIE_SECRET;
      process.env.CORS_ALLOWED_ORIGINS = 'https://example.com';
      expect(() => validateEnvironment()).toThrow(/COOKIE_SECRET/);
    });

    it('only WARNS for missing COOKIE_SECRET in dev (does not throw)', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.COOKIE_SECRET;
      expect(() => validateEnvironment()).not.toThrow();
    });
  });
});
