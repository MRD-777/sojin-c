// ============================================
// AuthService spec — Session 1.5 MVT
//
// Covers:
//   - A1: registerCompany emits 2 audit rows (Company.CREATE + User.CREATE)
//         inside the same $transaction.
//   - A8: all thrown errors are AppExceptions with the documented .code
//         field (callers/frontends localize on the code, not the string).
//   - A2 (indirect): successful login() DOES update lastLogin once.
//         The negative side (JwtStrategy must NOT update lastLogin) is
//         covered by jwt.strategy.spec.ts.
// ============================================
import type { Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { LoginAttemptsTracker } from './login-attempts.tracker';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  BusinessException,
  SystemException,
} from '../../common/errors/app-exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  createMockPrisma,
  type MockPrisma,
} from '../../test-utils/prisma-mock';
import {
  createMockAuditLog,
  type MockAuditLog,
} from '../../test-utils/audit-log-mock';
import {
  createMockSupabase,
  type MockSupabase,
} from '../../test-utils/supabase-mock';

// ─── Fixtures ────────────────────────────────────────────────

const VALID_REGISTER_DTO = {
  companyName: 'Acme Construction',
  companyEmail: 'info@acme.test',
  companyPhone: '+201234567',
  adminName: 'Alice Admin',
  adminEmail: 'alice@acme.test',
  adminPassword: 'StrongPass1!Secure',
};

const VALID_LOGIN_DTO = {
  email: 'alice@acme.test',
  password: 'StrongPass1!Secure',
};

function makeHealthyUserWithCompany() {
  return {
    id: 'user-1',
    name: 'Alice Admin',
    email: 'alice@acme.test',
    role: 'SUPER_ADMIN',
    specialty: null,
    avatar: null,
    preferredLanguage: 'AR',
    isActive: true,
    company: {
      id: 'co-1',
      name: 'Acme Construction',
      slug: 'acme-abc123',
      logo: null,
      subscriptionStatus: 'ACTIVE',
      deletedAt: null,
    },
  };
}

interface Harness {
  service: AuthService;
  prisma: MockPrisma;
  supabase: MockSupabase;
  auditLog: MockAuditLog;
  loginAttempts: LoginAttemptsTracker;
}

function build(): Harness {
  const prisma = createMockPrisma();
  const supabase = createMockSupabase();
  const auditLog = createMockAuditLog();
  const loginAttempts = new LoginAttemptsTracker();
  const service = new AuthService(
    prisma as unknown as PrismaService,
    loginAttempts,
    auditLog as unknown as AuditLogService,
    supabase as unknown as SupabaseClient,
  );
  return { service, prisma, supabase, auditLog, loginAttempts };
}

const mockReq = { ip: '127.0.0.1', headers: {} } as unknown as Request;

// ============================================
// registerCompany — A1 (audit) + A8 (error codes)
// ============================================

describe('AuthService.registerCompany — A1 audit, A8 error codes', () => {
  it('writes 2 audit rows (Company.CREATE + User.CREATE) inside the same transaction', async () => {
    const { service, prisma, auditLog } = build();

    // Happy path setup:
    //   - no duplicate company/user email
    //   - slug probe finds no collision on the first try
    //   - tx.company.create / tx.user.create succeed
    prisma.company.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.company.findUnique.mockResolvedValue(null);
    prisma.company.create.mockResolvedValue({
      id: 'co-1',
      name: 'Acme Construction',
      slug: 'acme-construction-abc123',
      email: 'info@acme.test',
      phone: '+201234567',
    });
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      name: 'Alice Admin',
      email: 'alice@acme.test',
      role: 'SUPER_ADMIN',
    });

    await service.registerCompany(VALID_REGISTER_DTO, mockReq);

    // CORE A1 invariant: TWO audit rows from this flow.
    expect(auditLog.logInTransaction).toHaveBeenCalledTimes(2);

    const entityTypes = auditLog.logInTransaction.mock.calls.map(
      (c) => c[1].entityType,
    );
    expect(entityTypes).toEqual(expect.arrayContaining(['company', 'user']));

    // Both rows must be CREATE actions and scoped to the new company.
    for (const [, entry] of auditLog.logInTransaction.mock.calls) {
      expect(entry.action).toBe('CREATE');
      expect(entry.companyId).toBe('co-1');
      expect(entry.oldValues).toBeNull();
    }

    // TEST-003 (Session 1.6) — forensic-integrity assertion.
    // The prior loop confirms BOTH entity types are present and CREATE,
    // but it does NOT prove each row's `entityId` points to the right
    // object. A swap (company row carrying user.id and vice versa) would
    // corrupt every forensic query keyed on entityId — and slip past the
    // loop above.
    const companyAudit = auditLog.logInTransaction.mock.calls.find(
      ([, e]) => e.entityType === 'company',
    )?.[1];
    const userAudit = auditLog.logInTransaction.mock.calls.find(
      ([, e]) => e.entityType === 'user',
    )?.[1];
    expect(companyAudit).toBeDefined();
    expect(userAudit).toBeDefined();
    expect(companyAudit!.entityId).toBe('co-1');
    expect(userAudit!.entityId).toBe('user-1');

    // And both audit rows MUST have been written inside a $transaction —
    // not as separate top-level writes.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // CVE-TEST-015 (Session 1.6 hacker re-attack) — paired primary-action
    // assertion. TEST-003 above proves the entityIds in the audit rows
    // match, but the audit rows are SIDE-EFFECTS. Without these two
    // assertions, a regression that empties `data: {}` on either create
    // (or swaps Company ↔ User payloads) leaves the (still-correct) audit
    // entries in place — same Session 1.5 false-confidence pattern that
    // TEST-001 closed for the update path, now closed for the create path.
    expect(prisma.company.create).toHaveBeenCalledTimes(1);
    expect(prisma.company.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Acme Construction',
        email: 'info@acme.test',
        phone: '+201234567',
      }),
    });
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'co-1',
        name: 'Alice Admin',
        email: 'alice@acme.test',
        role: 'SUPER_ADMIN',
      }),
    });
  });

  it('throws BusinessException(AUTH_BIZ_002) when company email is already registered', async () => {
    const { service, prisma, supabase, auditLog } = build();

    // Duplicate company email — validateRegistration rejects before Supabase.
    prisma.company.findFirst.mockResolvedValue({ id: 'existing-co' });

    await expect(
      service.registerCompany(VALID_REGISTER_DTO, mockReq),
    ).rejects.toMatchObject({
      // Asserting on .code (stable contract) — not on the Arabic message
      // (translatable and prone to wording drift).
      code: ErrorCodes.AUTH_BIZ_002,
    });

    // Defensive: nothing downstream should have been touched.
    expect(supabase.auth.admin.createUser).not.toHaveBeenCalled();
    expect(auditLog.logInTransaction).not.toHaveBeenCalled();
  });

  it('throws SystemException(AUTH_SYS_001) when Supabase createUser fails with a non-conflict error', async () => {
    const { service, prisma, supabase } = build();

    prisma.company.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    // Supabase is down / returning a generic error (NOT the "already
    // registered" case which is BIZ_002).
    supabase.auth.admin.createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'service unavailable' },
    });

    let caught: unknown;
    try {
      await service.registerCompany(VALID_REGISTER_DTO, mockReq);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SystemException);
    expect((caught as SystemException).code).toBe(ErrorCodes.AUTH_SYS_001);
  });
});

// ============================================
// login — A8 (error codes) + A2 (indirect: lastLogin update)
// ============================================

describe('AuthService.login — A8 error codes, A2 lastLogin update', () => {
  it('throws BusinessException(AUTH_BIZ_006) on wrong credentials', async () => {
    const { service, supabase, loginAttempts } = build();

    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    let caught: unknown;
    try {
      await service.login(VALID_LOGIN_DTO);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(ErrorCodes.AUTH_BIZ_006);

    // TEST-008 (Session 1.6) — lockout side-effect paired assertion.
    // The throw above is the user-facing behavior. The skill-03 §12
    // lockout policy ALSO requires that this failure be recorded — if a
    // future cleanup drops the `recordFailure(email)` call, the 5-fails/
    // 15-min lock becomes dead code that silently disables itself. We
    // assert via the tracker's public API (real instance, not a mock).
    expect(loginAttempts.check(VALID_LOGIN_DTO.email).failures).toBe(1);
  });

  // CVE-TEST-012 (Session 1.6 hacker re-attack) — multi-failure increment.
  // TEST-008 above only proves the counter reaches 1 after one rejection.
  // A regression where `recordFailure` silently caps at 1 (e.g.
  //   `rec.failures = 1`  instead of  `rec.failures += 1`)
  // would still pass TEST-008 — but the 5-failure lockout never fires
  // because the counter can never reach MAX_FAILURES. We need ≥2 to prove
  // the increment is real.
  it('increments the failure counter on consecutive wrong-credential attempts', async () => {
    const { service, supabase, loginAttempts } = build();

    supabase.auth.signInWithPassword
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

    await expect(service.login(VALID_LOGIN_DTO)).rejects.toBeInstanceOf(
      BusinessException,
    );
    await expect(service.login(VALID_LOGIN_DTO)).rejects.toBeInstanceOf(
      BusinessException,
    );

    // Two rejections → failures MUST be 2, not 1. Anything else means the
    // counter is broken and the lockout policy will never trigger.
    expect(loginAttempts.check(VALID_LOGIN_DTO.email).failures).toBe(2);
  });

  it('updates lastLogin exactly once on a successful login (A2 indirect)', async () => {
    const { service, prisma } = build();

    prisma.user.findFirst.mockResolvedValue(makeHealthyUserWithCompany());
    // The fire-and-forget `.catch(...)` chain on the update return value
    // requires a real promise — without this the chain throws on undefined.
    prisma.user.update.mockResolvedValue({});

    await service.login(VALID_LOGIN_DTO);

    // Yield one microtask so the fire-and-forget `prisma.user.update`
    // call has registered with the jest mock before we assert.
    await Promise.resolve();

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const [args] = prisma.user.update.mock.calls;
    expect(args[0]).toMatchObject({
      where: { id: 'user-1' },
      data: { lastLogin: expect.any(Date) },
    });
  });

  // Tester (Session 1.6) — recordSuccess integration coverage.
  // The login flow's lockout state machine has three integration touchpoints:
  //   1. failure path  → `recordFailure` is called      (TEST-008)
  //   2. multi-failure → counter actually increments     (CVE-TEST-012)
  //   3. success path  → `recordSuccess` resets counter  (THIS SPEC)
  // Without (3), a regression that drops `recordSuccess` would leave the
  // counter accumulating across legitimate logins until the next failure
  // locks the account prematurely. The unit-level tracker spec proves
  // recordSuccess clears state in isolation; this spec proves AuthService
  // actually calls it on the right code path.
  it('resets the failure counter on a successful login (recordSuccess integration)', async () => {
    const { service, prisma, loginAttempts } = build();

    // Pre-load 4 consecutive failures — one below MAX_FAILURES=5. If
    // recordSuccess fails to fire, the next single failure would lock
    // the account on an attempt that began with a successful login in
    // between. That silent degradation is what this spec catches.
    for (let i = 0; i < 4; i++) {
      loginAttempts.recordFailure(VALID_LOGIN_DTO.email);
    }
    expect(loginAttempts.check(VALID_LOGIN_DTO.email).failures).toBe(4);

    prisma.user.findFirst.mockResolvedValue(makeHealthyUserWithCompany());
    // Fire-and-forget lastLogin update needs a real promise to .catch().
    prisma.user.update.mockResolvedValue({});

    await service.login(VALID_LOGIN_DTO);

    // Drain microtask so the fire-and-forget lastLogin promise resolves
    // before we read counter state — keeps this spec deterministic.
    await Promise.resolve();

    expect(loginAttempts.check(VALID_LOGIN_DTO.email).failures).toBe(0);
    expect(loginAttempts.check(VALID_LOGIN_DTO.email).locked).toBe(false);
  });

  // TEST-004 (Session 1.6) — fire-and-forget regression net.
  // The spec above proves the update is *called*; this proves the caller
  // does not *await* it. If a future refactor changes the `.catch()` chain
  // to a blocking `await`, the login flow would start failing whenever
  // the lastLogin write fails (read-replica lag, write-lock, etc.) —
  // turning a non-critical bookkeeping write into a login-blocking one.
  it('returns success even when the fire-and-forget lastLogin update rejects', async () => {
    const { service, prisma } = build();

    prisma.user.findFirst.mockResolvedValue(makeHealthyUserWithCompany());
    prisma.user.update.mockRejectedValue(new Error('DB unavailable'));

    // The login MUST resolve — not throw. If the implementation awaits
    // the update, this rejects and the test catches the regression.
    const result = await service.login(VALID_LOGIN_DTO);
    expect(result).toBeDefined();
    expect((result as { accessToken?: string }).accessToken).toBeDefined();

    // Drain microtasks so the rejected fire-and-forget promise resolves
    // before the test exits — otherwise jest may print an unhandled-
    // rejection warning that masks real failures elsewhere.
    await Promise.resolve();
    await Promise.resolve();

    // Sanity: the update WAS attempted, but its rejection was absorbed.
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });
});
