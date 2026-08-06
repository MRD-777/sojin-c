// ============================================
// Smoke tests for the test-utils mocks themselves.
// Cheap insurance: if these break, every downstream service spec breaks.
// ============================================
import { createMockPrisma, MockPrisma } from './prisma-mock';
import { createMockAuditLog } from './audit-log-mock';
import { createMockSupabase } from './supabase-mock';

describe('test-utils', () => {
  describe('createMockPrisma', () => {
    it('exposes user and company models with the expected methods', () => {
      const prisma = createMockPrisma();
      for (const model of [prisma.user, prisma.company]) {
        expect(jest.isMockFunction(model.findFirst)).toBe(true);
        expect(jest.isMockFunction(model.findUnique)).toBe(true);
        expect(jest.isMockFunction(model.findMany)).toBe(true);
        expect(jest.isMockFunction(model.create)).toBe(true);
        expect(jest.isMockFunction(model.update)).toBe(true);
        expect(jest.isMockFunction(model.count)).toBe(true);
      }
    });

    it('softDeleteFilter matches the real PrismaService getter', () => {
      expect(createMockPrisma().softDeleteFilter).toEqual({ deletedAt: null });
    });

    it('$transaction invokes the callback with the same mock as tx', async () => {
      const prisma = createMockPrisma();
      prisma.user.create.mockResolvedValue({ id: 'u-1' });

      const result = await prisma.$transaction(async (tx: MockPrisma) => {
        // tx must alias the outer prisma — assertions on prisma.user.create
        // should see the call made via tx.user.create.
        const user = await tx.user.create({ data: { name: 'A' } });
        return user;
      });

      expect(result).toEqual({ id: 'u-1' });
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('$transaction supports the array form (resolves promises in order)', async () => {
      const prisma = createMockPrisma();
      const out = await prisma.$transaction([
        Promise.resolve('a'),
        Promise.resolve('b'),
      ]);
      expect(out).toEqual(['a', 'b']);
    });

    it('returns a fresh instance per call (no state leaks across tests)', () => {
      const a = createMockPrisma();
      const b = createMockPrisma();
      a.user.findFirst.mockResolvedValue({ id: 'x' });
      expect(b.user.findFirst).not.toBe(a.user.findFirst);
      expect(b.user.findFirst.mock.calls.length).toBe(0);
    });
  });

  describe('createMockAuditLog', () => {
    it('exposes logInTransaction and log as jest.fn()', () => {
      const auditLog = createMockAuditLog();
      expect(jest.isMockFunction(auditLog.logInTransaction)).toBe(true);
      expect(jest.isMockFunction(auditLog.log)).toBe(true);
    });

    it('both methods resolve to undefined by default', async () => {
      const auditLog = createMockAuditLog();
      await expect(
        auditLog.logInTransaction({}, { entityType: 'user' }),
      ).resolves.toBeUndefined();
      await expect(auditLog.log({ entityType: 'user' })).resolves.toBeUndefined();
    });
  });

  describe('createMockSupabase', () => {
    it('exposes the auth.admin surface used by auth + users services', () => {
      const sb = createMockSupabase();
      expect(jest.isMockFunction(sb.auth.admin.createUser)).toBe(true);
      expect(jest.isMockFunction(sb.auth.admin.deleteUser)).toBe(true);
      expect(jest.isMockFunction(sb.auth.admin.updateUserById)).toBe(true);
      expect(jest.isMockFunction(sb.auth.admin.signOut)).toBe(true);
      expect(jest.isMockFunction(sb.auth.signInWithPassword)).toBe(true);
      expect(jest.isMockFunction(sb.auth.refreshSession)).toBe(true);
    });

    it('createUser default returns a mock user id with no error', async () => {
      const sb = createMockSupabase();
      const out = await sb.auth.admin.createUser({ email: 'x@y.z' });
      expect(out.error).toBeNull();
      expect(out.data.user.id).toBe('sup-mock-id');
    });

    it('signInWithPassword default returns a session with access + refresh tokens', async () => {
      const sb = createMockSupabase();
      const out = await sb.auth.signInWithPassword({
        email: 'x@y.z',
        password: 'p',
      });
      expect(out.error).toBeNull();
      expect(out.data.session.access_token).toBe('access.jwt.mock');
      expect(out.data.session.refresh_token).toBe('refresh.mock');
      expect(typeof out.data.session.expires_at).toBe('number');
    });

    it('refreshSession default returns rotated tokens', async () => {
      const sb = createMockSupabase();
      const out = await sb.auth.refreshSession({ refresh_token: 'old' });
      expect(out.data.session.access_token).toBe('access.jwt.rotated');
      expect(out.data.session.refresh_token).toBe('refresh.rotated');
    });
  });
});
