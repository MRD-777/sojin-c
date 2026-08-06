// ============================================
// UsersService spec — Session 1.5 MVT
//
// Covers:
//   - CVE-USERS-005 (Phase 2): generateSecurePassword has no modulo bias.
//   - A3 (Phase 5): deactivate/activate manage the Supabase ban_duration.
//   - A4 (Phase 5): create response shape — tempPassword is echoed back
//                   only when the service generated it (not when the
//                   admin supplied one).
//   - A5 (Phase 5): updateMyProfile audit row's oldValues snapshot
//                   contains ONLY the fields the caller is changing.
//   - CVE-USERS-004 (Phase 5): the same selectivity invariant on the
//                   admin-side `update()` flow.
// ============================================
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TierLimitsService } from '../companies/tier-limits.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { UsersService } from './users.service';
import { JwtPayload } from '../../common/decorators';
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

/**
 * The full charset the password generator draws from. MUST stay in sync
 * with the constant inside UsersService.generateSecurePassword. If it
 * drifts, the distribution test would silently mis-bucket and either
 * miss a regression or fire on a non-regression.
 */
const PASSWORD_CHARSET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';

function buildService(): UsersService {
  return new UsersService(
    createMockPrisma() as unknown as PrismaService,
    createMockAuditLog() as unknown as AuditLogService,
    { assertCanAddUser: jest.fn() } as unknown as TierLimitsService,
    createMockSupabase() as unknown as SupabaseClient,
  );
}

// ─── Harness for tests that need to inspect the mocks ───────
interface Harness {
  service: UsersService;
  prisma: MockPrisma;
  auditLog: MockAuditLog;
  supabase: MockSupabase;
  tierLimits: { assertCanAddUser: jest.Mock };
}

function buildHarness(): Harness {
  const prisma = createMockPrisma();
  const auditLog = createMockAuditLog();
  const supabase = createMockSupabase();
  const tierLimits = {
    assertCanAddUser: jest.fn().mockResolvedValue(undefined),
  };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    auditLog as unknown as AuditLogService,
    tierLimits as unknown as TierLimitsService,
    supabase as unknown as SupabaseClient,
  );
  return { service, prisma, auditLog, supabase, tierLimits };
}

const mockReq = { ip: '127.0.0.1', headers: {} } as unknown as Request;

const adminJwt: JwtPayload = {
  sub: 'sup-admin',
  email: 'admin@co.test',
  userId: 'admin-1',
  companyId: 'co-1',
  role: 'SUPER_ADMIN',
  permissions: [],
};

describe('UsersService.generateSecurePassword (CVE-USERS-005)', () => {
  // The method is private — access via the `unknown as` escape hatch.
  // Tests are the only consumer of this; production callers go through
  // `create()`.
  function gen(service: UsersService): string {
    return (service as unknown as { generateSecurePassword(): string })
      .generateSecurePassword();
  }

  it('produces a 16-character output', () => {
    const service = buildService();
    for (let i = 0; i < 20; i++) {
      expect(gen(service).length).toBe(16);
    }
  });

  it('every character comes from the documented charset', () => {
    const service = buildService();
    const allowed = new Set(PASSWORD_CHARSET);
    for (let i = 0; i < 50; i++) {
      for (const ch of gen(service)) {
        expect(allowed.has(ch)).toBe(true);
      }
    }
  });

  it(
    'is uniformly distributed across the 62-char alphabet (no modulo bias)',
    () => {
      const service = buildService();

      // 10,000 passwords × 16 chars = 160,000 samples across 62 buckets.
      // Expected per-bucket: 160,000 / 62 ≈ 2580.
      // Tolerance: ±14% → [2220, 2940].
      //
      // The OLD bug (byte % 62 where 256 = 62*4 + 8) gave the first 8
      // chars probability 5/256 ≈ 1.95% (≈3125 hits) while the rest got
      // 4/256 ≈ 1.56% (≈2500 hits). Under the [2220, 2940] band, those
      // first-8 buckets would exceed the upper bound and fail the test —
      // exactly what we want as a regression net.
      const SAMPLES = 10_000;
      const LENGTH = 16;
      const counts = new Map<string, number>();
      for (const ch of PASSWORD_CHARSET) counts.set(ch, 0);

      for (let i = 0; i < SAMPLES; i++) {
        for (const ch of gen(service)) {
          counts.set(ch, (counts.get(ch) ?? 0) + 1);
        }
      }

      const expected = (SAMPLES * LENGTH) / PASSWORD_CHARSET.length;
      const lower = Math.floor(expected * 0.86); // -14%
      const upper = Math.ceil(expected * 1.14);  // +14%

      const outliers: Array<{ char: string; count: number }> = [];
      for (const [char, count] of counts) {
        if (count < lower || count > upper) outliers.push({ char, count });
      }

      // If this fails, log the outliers — makes triage in CI much faster
      // than just an `expected toBe true` line.
      if (outliers.length > 0) {
        // eslint-disable-next-line no-console
        console.error(
          `Distribution outliers (expected ≈${expected.toFixed(0)}, ` +
            `band [${lower}, ${upper}]):`,
          outliers,
        );
      }
      expect(outliers).toEqual([]);
    },
    // Bump the timeout — 10k iterations × 16 chars × rejection-sampling
    // loop is comfortably under 1s locally but CI may be slower.
    15_000,
  );

  // TEST-010 (Session 1.6) — integration smoke complement.
  // The three specs above exercise the *private* method directly via the
  // `as unknown as` escape hatch. That protects the algorithm, but it
  // does NOT protect the integration path: a future refactor that adds
  // post-processing in `create()` (e.g. "ensure at least one symbol" via
  // a replacement loop) could break the charset/distribution invariant
  // without any of the private-method tests firing. This 20-sample smoke
  // run catches charset drift in the actual `create()` exit; the heavy
  // 10k-sample distribution run stays on the private method where it's
  // cheap.
  it('create() returns a password drawn from the documented charset (smoke)', async () => {
    const allowed = new Set(PASSWORD_CHARSET);

    for (let i = 0; i < 20; i++) {
      const { service, prisma, supabase } = buildHarness();
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: `u-${i}` });

      const result = (await service.create(
        adminJwt,
        { name: 'X', email: `u${i}@co.test`, role: 'WORKER' },
        mockReq,
      )) as { tempPassword?: string };

      expect(result.tempPassword).toBeDefined();
      expect(result.tempPassword).toHaveLength(16);
      for (const ch of result.tempPassword!) {
        expect(allowed.has(ch)).toBe(true);
      }

      // CVE-TEST-011 (Session 1.6 hacker re-attack) — paired primary-action
      // assertion. Without this, a regression that returns a charset-OK
      // password in the response BUT passes a different/weaker string to
      // Supabase (e.g. `password: tempPassword.slice(0, 8)`) slips past
      // every charset/length check above. The smoke must prove the password
      // surfaced to the admin is the SAME one bound to the Supabase user.
      expect(supabase.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ password: result.tempPassword }),
      );
    }
  });
});

// ============================================
// A3 — deactivate / activate manage Supabase ban_duration
// ============================================

describe('UsersService.deactivate / activate (A3 — Supabase ban management)', () => {
  /**
   * The target user is a non-SUPER_ADMIN so the `ensureNotLastSuperAdmin`
   * guard isn't exercised here (covered by separate specs in a later
   * session). Focus stays on the Supabase side-effect.
   */
  function makeWorkerTarget() {
    return {
      id: 'target-1',
      companyId: 'co-1',
      name: 'Worker One',
      email: 'worker@co.test',
      role: 'WORKER',
      isActive: true,
      supabaseAuthId: 'sup-target-1',
    };
  }

  it('deactivate calls supabase.updateUserById with ban_duration=24h', async () => {
    const { service, prisma, supabase, auditLog } = buildHarness();

    prisma.user.findFirst.mockResolvedValue(makeWorkerTarget());
    prisma.user.update.mockResolvedValue({ id: 'target-1', isActive: false });

    await service.deactivate(adminJwt, 'target-1', mockReq);

    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledTimes(1);
    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
      'sup-target-1',
      { ban_duration: '24h' },
    );

    // TEST-007-A (Session 1.6) — audit-content paired assertion.
    // The Supabase ban above is a side-effect; this spec ALSO proves that
    // the audit row reflects the actual DB transition. The `oldValues` is
    // now derived from `target.isActive` (CVE-TEST-016, Session 1.7), so
    // this assertion holds because the mock pre-fetched the target as
    // active — see TEST-007-C below for the no-op transition that proves
    // the derivation is real (not hardcoded).
    expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
    const entry = auditLog.logInTransaction.mock.calls[0][1];
    expect(entry.entityType).toBe('user');
    expect(entry.entityId).toBe('target-1');
    expect(entry.action).toBe('UPDATE');
    expect(entry.oldValues).toEqual({ isActive: true });
    expect(entry.newValues).toEqual({ isActive: false });
  });

  it('activate calls supabase.updateUserById with ban_duration=none', async () => {
    const { service, prisma, supabase, auditLog } = buildHarness();

    prisma.user.findFirst.mockResolvedValue({
      ...makeWorkerTarget(),
      isActive: false,
    });
    prisma.user.update.mockResolvedValue({ id: 'target-1', isActive: true });

    await service.activate(adminJwt, 'target-1', mockReq);

    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledTimes(1);
    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
      'sup-target-1',
      { ban_duration: 'none' },
    );

    // TEST-007-B (Session 1.6) — mirror of TEST-007-A for the reverse
    // transition. The `oldValues.isActive` is derived from the pre-fetched
    // target (CVE-TEST-016, Session 1.7), and the mock above sets the
    // target as inactive — so this assertion holds. TEST-007-C below
    // exercises the no-op case where the hardcoded-vs-derived distinction
    // actually matters.
    expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
    const entry = auditLog.logInTransaction.mock.calls[0][1];
    expect(entry.entityType).toBe('user');
    expect(entry.entityId).toBe('target-1');
    expect(entry.action).toBe('UPDATE');
    expect(entry.oldValues).toEqual({ isActive: false });
    expect(entry.newValues).toEqual({ isActive: true });
  });

  // TEST-007-C (Session 1.7) — CVE-TEST-016 regression net.
  // Before the fix, production hardcoded `oldValues: { isActive: false }`
  // in activate (and `{ isActive: true }` in deactivate) — regardless of
  // the user's actual prior state. A no-op activate on an already-active
  // user logged a fake `false → true` transition. Forensic reviews keyed
  // on audit history would mis-attribute a state change that never
  // happened. With the fix, `oldValues.isActive` is derived from
  // `target.isActive` (pre-fetch). This spec proves the derivation —
  // TEST-007-B alone cannot, because its mock target happens to align
  // with the (old) hardcoded value.
  it('activate audit on a no-op transition (already-active target) reflects true state', async () => {
    const { service, prisma, auditLog } = buildHarness();

    prisma.user.findFirst.mockResolvedValue({
      ...makeWorkerTarget(),
      isActive: true, // ← already active; activating is a no-op
    });
    prisma.user.update.mockResolvedValue({ id: 'target-1', isActive: true });

    await service.activate(adminJwt, 'target-1', mockReq);

    expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
    const entry = auditLog.logInTransaction.mock.calls[0][1];
    // Honest forensic trail: oldValues MUST mirror the actual prior state.
    // A regression to `oldValues: { isActive: false }` (the old constant)
    // would fire this assertion immediately.
    expect(entry.oldValues).toEqual({ isActive: true });
    expect(entry.newValues).toEqual({ isActive: true });
  });

  // TEST-006 (Session 1.6) — defensive-path regression net.
  // Legacy users (pre-Supabase integration) may have `supabaseAuthId: null`
  // in the DB. The implementation guards the Supabase call with
  // `if (target.supabaseAuthId)`. If a future cleanup drops that guard,
  // `updateUserById(null, ...)` would throw at the SDK layer and crash
  // an otherwise valid deactivate flow.
  it('deactivate skips the Supabase call when supabaseAuthId is null (legacy user)', async () => {
    const { service, prisma, supabase, auditLog } = buildHarness();

    prisma.user.findFirst.mockResolvedValue({
      ...makeWorkerTarget(),
      supabaseAuthId: null,
    });
    prisma.user.update.mockResolvedValue({ id: 'target-1', isActive: false });

    await service.deactivate(adminJwt, 'target-1', mockReq);

    expect(supabase.auth.admin.updateUserById).not.toHaveBeenCalled();

    // CVE-TEST-013 (Session 1.6 hacker re-attack) — paired DB+audit
    // assertion. The not-called assertion above only proves "no Supabase
    // SDK crash on null id". It does NOT prove the deactivation actually
    // happened in the DB. A regression that turns the guard into
    //   `if (!target.supabaseAuthId) { return /* skip everything */ }`
    // would slip past the negative Supabase assertion silently — the
    // legacy user would stay active forever. Assert the primary action.
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-1' },
        data: { isActive: false },
      }),
    );
    expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
  });
});

// ============================================
// A4 — create() echoes tempPassword only when WE generated it
// ============================================

describe('UsersService.create (A4 — conditional tempPassword echo)', () => {
  const baseDto = {
    name: 'New User',
    email: 'newuser@co.test',
    role: 'WORKER',
  };

  it('returns tempPassword + warning when the admin did NOT supply a password', async () => {
    const { service, prisma, auditLog } = buildHarness();

    prisma.user.findFirst.mockResolvedValue(null); // no duplicate email
    prisma.user.create.mockResolvedValue({
      id: 'new-1',
      name: baseDto.name,
      email: baseDto.email,
      role: baseDto.role,
    });

    const result = (await service.create(adminJwt, baseDto, mockReq)) as {
      user: unknown;
      tempPassword?: string;
      mustSharePasswordSecurely?: string;
    };

    expect(result.user).toBeDefined();
    expect(typeof result.tempPassword).toBe('string');
    expect(result.tempPassword).toHaveLength(16);
    // The Arabic warning text doesn't need exact-match — just confirm
    // SOMETHING was returned so the frontend knows to display it.
    expect(typeof result.mustSharePasswordSecurely).toBe('string');
    expect(result.mustSharePasswordSecurely!.length).toBeGreaterThan(0);

    // TEST-002 (Session 1.6) — sensitive-payload-leak assertion.
    // The response shape above proves the password is echoed to the
    // admin; this proves it is NOT echoed into the append-only audit
    // table. A drift to `newValues: { ...dto }` would silently leak the
    // generated temp password into audit_logs forever.
    expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
    const auditEntry = auditLog.logInTransaction.mock.calls[0][1];
    expect(auditEntry.newValues).not.toHaveProperty('password');
    expect(auditEntry.newValues).not.toHaveProperty('tempPassword');
    expect(auditEntry.newValues).not.toHaveProperty('supabaseAuthId');
  });

  it('does NOT echo a password back when the admin supplied one', async () => {
    const { service, prisma, auditLog } = buildHarness();

    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-1',
      name: baseDto.name,
      email: baseDto.email,
      role: baseDto.role,
    });

    const result = (await service.create(
      adminJwt,
      { ...baseDto, password: 'AdminPicked!1Pw' },
      mockReq,
    )) as {
      user: unknown;
      tempPassword?: string;
      mustSharePasswordSecurely?: string;
    };

    expect(result.user).toBeDefined();
    // The whole point of the Q1=A refinement: never echo a password the
    // admin already knows. Reduces wire/log exposure.
    expect(result.tempPassword).toBeUndefined();
    expect(result.mustSharePasswordSecurely).toBeUndefined();

    // TEST-002 (Session 1.6) — same redaction invariant as the generated-
    // password path. The admin's password is even more sensitive (reused
    // across systems by humans) — assert audit never sees it.
    expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
    const auditEntry = auditLog.logInTransaction.mock.calls[0][1];
    expect(auditEntry.newValues).not.toHaveProperty('password');
    expect(auditEntry.newValues).not.toHaveProperty('tempPassword');
    expect(auditEntry.newValues).not.toHaveProperty('supabaseAuthId');
  });

  // TEST-005 (Session 1.6) — tier-limit ordering regression net.
  // The design intent (users.service.ts:217): `tierLimits.assertCanAddUser`
  // runs BEFORE the Supabase createUser call, so a company that has hit
  // its plan limit cannot accidentally create an orphan Supabase auth
  // user (which the SDK does NOT roll back). If a future refactor moves
  // the tier check after the Supabase call, this spec fires.
  it('checks the tier limit BEFORE touching Supabase', async () => {
    const { service, prisma, tierLimits, supabase } = buildHarness();

    prisma.user.findFirst.mockResolvedValue(null); // no duplicate email
    tierLimits.assertCanAddUser.mockRejectedValueOnce(
      new Error('tier limit hit'),
    );

    await expect(
      service.create(adminJwt, baseDto, mockReq),
    ).rejects.toThrow();

    // The whole point of the ordering invariant: Supabase must not be
    // touched at all — and no DB row created — when the tier rejects.
    expect(supabase.auth.admin.createUser).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

// ============================================
// A5 + CVE-USERS-004 — audit oldValues includes ONLY changed fields
// ============================================

describe('UsersService audit oldValues selectivity', () => {
  it('updateMyProfile (A5): oldValues snapshot is scoped to changed fields only', async () => {
    const { service, prisma, auditLog } = buildHarness();

    // Pre-fetch returns the full identity snapshot — the implementation
    // must pick only the fields the DTO is changing.
    prisma.user.findFirst.mockResolvedValue({
      name: 'Old Name',
      phone: '+201000000',
      avatar: null,
      notificationPreferences: null,
      preferredLanguage: 'AR',
    });
    prisma.user.update.mockResolvedValue({ id: 'admin-1', phone: '+201999999' });

    await service.updateMyProfile(
      adminJwt,
      { phone: '+201999999' }, // ONLY phone is changing
      mockReq,
    );

    expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
    const [, entry] = auditLog.logInTransaction.mock.calls[0];
    expect(entry.entityType).toBe('user');
    expect(entry.action).toBe('UPDATE');
    // CORE A5 assertion: the snapshot is exactly { phone } — nothing
    // bleeds in from the pre-fetch.
    expect(entry.oldValues).toEqual({ phone: '+201000000' });

    // TEST-001 (Session 1.6) — paired DB-write assertion.
    // The audit row above only proves *what we intended to write*; it does
    // NOT prove the actual DB mutation happened with the right payload.
    // Without this, a refactor that drops `data` would still pass the
    // audit-side assertion silently.
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'admin-1' },
        data: { phone: '+201999999' },
      }),
    );
  });

  it('update (CVE-USERS-004): oldValues includes specialty + avatar but NOT unchanged fields', async () => {
    const { service, prisma, auditLog } = buildHarness();

    // The previous (pre-hacker-fix) implementation always snapshotted
    // { name, phone } regardless of what the DTO changed — a forensic
    // gap when specialty/avatar/preferredLanguage were the real changes.
    prisma.user.findFirst.mockResolvedValue({
      id: 'target-1',
      companyId: 'co-1',
      name: 'TargetName',
      phone: '+201222222',
      specialty: 'OldSpec',
      avatar: 'https://old.avatar',
      preferredLanguage: 'AR',
    });
    prisma.user.update.mockResolvedValue({ id: 'target-1' });

    await service.update(
      adminJwt,
      'target-1',
      { specialty: 'NewSpec', avatar: 'https://new.avatar' },
      mockReq,
    );

    expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
    const [, entry] = auditLog.logInTransaction.mock.calls[0];
    // Exactly the two fields the DTO is changing — and nothing else.
    expect(entry.oldValues).toEqual({
      specialty: 'OldSpec',
      avatar: 'https://old.avatar',
    });
    // Belt-and-suspenders — assert the keys absent. If a future change
    // re-introduces the old { name, phone }-always snapshot, this fails.
    expect(entry.oldValues).not.toHaveProperty('name');
    expect(entry.oldValues).not.toHaveProperty('phone');
    expect(entry.oldValues).not.toHaveProperty('preferredLanguage');

    // TEST-001 (Session 1.6) — paired DB-write assertion.
    // Same reason as the A5 spec: a regression that empties `data` would
    // still leave the (correct) audit snapshot in place and slip past.
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-1' },
        data: { specialty: 'NewSpec', avatar: 'https://new.avatar' },
      }),
    );
  });
});
