// ============================================
// JwtStrategy spec — Session 1.5 MVT for A2
//
// CORE invariant under test (A2, Session 1):
//   JwtStrategy.validate() MUST NOT write to the database.
//
// Before the fix, every authenticated request triggered
//   prisma.user.update({ lastLogin: now })
// inside .validate(). That turned `lastLogin` into a "lastRequest"
// counter and added a write hotspot to every API call. The fix moved
// the update to AuthService.login() (once per actual login).
//
// If a future change re-introduces a write here, the second test in this
// file fails — which is the entire point of writing it.
// ============================================
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';
import { createMockPrisma, MockPrisma } from '../../test-utils/prisma-mock';

// jwks-rsa pulls in `jose` (pure ESM), which Jest does not transform. These
// tests exercise validate() only — the JWKS provider is never invoked — so we
// stub the module to a no-op secretOrKeyProvider. Keeps construction working
// without loading the ESM dependency graph.
jest.mock('jwks-rsa', () => ({
  passportJwtSecret: () => (_req: unknown, _raw: unknown, done: (e: unknown, k: string) => void) =>
    done(null, 'test-key'),
}));

/** Default shape for a "healthy" user — overridden per-test as needed. */
function makeActiveUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    companyId: 'co-1',
    role: 'PROJECT_MANAGER',
    isActive: true,
    customPermissions: [],
    company: {
      id: 'co-1',
      subscriptionStatus: 'ACTIVE',
      deletedAt: null,
    },
    ...overrides,
  };
}

function buildStrategy(prisma: MockPrisma): JwtStrategy {
  // Minimal ConfigService stub — JwtStrategy reads only NEXT_PUBLIC_SUPABASE_URL,
  // and only in the constructor (used to build the JWKS URI / issuer for
  // passport-jwt's super(...) call). No network call happens at construction.
  const config = {
    get: (key: string) =>
      key === 'NEXT_PUBLIC_SUPABASE_URL' ? 'https://project.supabase.co' : undefined,
  } as unknown as ConfigService;
  return new JwtStrategy(config, prisma as unknown as PrismaService);
}

describe('JwtStrategy.validate (A2 — no DB write per request)', () => {
  let prisma: MockPrisma;
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = createMockPrisma();
    strategy = buildStrategy(prisma);
  });

  it('returns the expected JwtPayload shape on a healthy user', async () => {
    const user = makeActiveUser({ customPermissions: ['projects.read'] });
    prisma.user.findFirst.mockResolvedValue(user);

    const payload = await strategy.validate({ sub: 'sup-abc' });

    expect(payload).toEqual({
      sub: 'sup-abc',
      email: 'alice@example.com',
      userId: 'user-1',
      companyId: 'co-1',
      role: 'PROJECT_MANAGER',
      permissions: ['projects.read'],
    });
  });

  it(
    'does NOT write to the database during validation (CORE A2 regression net)',
    async () => {
      prisma.user.findFirst.mockResolvedValue(makeActiveUser());

      await strategy.validate({ sub: 'sup-abc' });

      // The whole point: zero writes from .validate(). If a refactor adds
      // a heartbeat or activity-tracker back into the strategy, this fires.
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects a deactivated user with UnauthorizedException', async () => {
    prisma.user.findFirst.mockResolvedValue(makeActiveUser({ isActive: false }));

    await expect(strategy.validate({ sub: 'sup-abc' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // Belt and suspenders: even on the failing path, no DB write happens.
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
