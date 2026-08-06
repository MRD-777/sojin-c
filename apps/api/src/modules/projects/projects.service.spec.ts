// ============================================
// ProjectsService spec — Session 2 (Projects + Phases review)
//
// Covers (21 specs total, this file = 14):
//
// Projects MVT (8 specs, from 00-plan.md):
//   P1 — create() rejects cross-tenant clientId.
//   P2 — create() rejects when target user is not CLIENT role.
//   P3 — findAll() CLIENT path restricts where.clientId = user.userId.
//   P4 — findAll() SITE_ENGINEER path restricts via assignments.
//   P5 — changeStatus() rejects invalid transition (DRAFT → COMPLETED).
//   P6 — changeStatus() CANCELLED writes audit DELETE with reason
//        (PAIRED-ASSERTION on logInTransaction — rule #4, CVE-TEST-011
//        lesson: the deepest primary action is the audit row, not the
//        project.status flip).
//   P7 — softDelete() rejects reason < 20 chars.
//   P8 — assignMember() rejects CLIENT/PM/SUPER_ADMIN target (F1 closure).
//
// ensureProjectAccess (6 specs, CVE-PROJ-001 + A2 closure — Session 2 Stage 2):
//   EA1 — SUPER_ADMIN passing cross-tenant projectId → ForbiddenException.
//   EA2 — PROJECT_MANAGER cross-tenant → ForbiddenException.
//   EA3 — SUPER_ADMIN own-company + not-deleted → resolves cleanly.
//   EA4 — SUPER_ADMIN own-company + deleted → ForbiddenException
//         (A2 closure — softDeleteFilter is part of the first lookup).
//   EA5 — CLIENT non-owner (in own company) → ForbiddenException.
//   EA6 — SITE_ENGINEER without active assignment → ForbiddenException.
// ============================================
import type { Request } from 'express';
import { BadRequestException, ForbiddenException, NotFoundException }
  from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TierLimitsService } from '../companies/tier-limits.service';
import { ProjectsService } from './projects.service';
import { JwtPayload } from '../../common/decorators';
import {
  createMockPrisma,
  type MockPrisma,
} from '../../test-utils/prisma-mock';
import {
  createMockAuditLog,
  type MockAuditLog,
} from '../../test-utils/audit-log-mock';

interface Harness {
  service: ProjectsService;
  prisma: MockPrisma;
  auditLog: MockAuditLog;
  tierLimits: { assertCanAddProject: jest.Mock };
}

function buildHarness(): Harness {
  const prisma = createMockPrisma();
  const auditLog = createMockAuditLog();
  const tierLimits = {
    assertCanAddProject: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ProjectsService(
    prisma as unknown as PrismaService,
    auditLog as unknown as AuditLogService,
    tierLimits as unknown as TierLimitsService,
  );
  return { service, prisma, auditLog, tierLimits };
}

const mockReq = { ip: '127.0.0.1', headers: {} } as unknown as Request;

const superAdmin: JwtPayload = {
  sub: 'sup-1', email: 'sa@co.test', userId: 'sa-1',
  companyId: 'co-A', role: 'SUPER_ADMIN', permissions: [],
};
const pm: JwtPayload = {
  sub: 'sup-2', email: 'pm@co.test', userId: 'pm-1',
  companyId: 'co-A', role: 'PROJECT_MANAGER', permissions: [],
};
const client: JwtPayload = {
  sub: 'sup-3', email: 'client@co.test', userId: 'client-1',
  companyId: 'co-A', role: 'CLIENT', permissions: [],
};
const engineer: JwtPayload = {
  sub: 'sup-4', email: 'eng@co.test', userId: 'eng-1',
  companyId: 'co-A', role: 'SITE_ENGINEER', permissions: [],
};

// ────────────────────────────────────────────────────────────
// Projects MVT (8 specs)
// ────────────────────────────────────────────────────────────

describe('ProjectsService.create — P1, P2 (tenant + role gates)', () => {
  it('P1: rejects when client lookup returns null (cross-tenant clientId)', async () => {
    const { service, prisma } = buildHarness();
    // Simulate "no matching client in user.companyId" — typically because
    // the clientId actually belongs to a different tenant.
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        superAdmin,
        { name: 'Tower X', clientId: 'client-from-other-tenant' } as never,
        mockReq,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The user lookup must be tenant-scoped (defense-in-depth).
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'co-A',
          role: 'CLIENT',
        }),
      }),
    );
  });

  it('P2: rejects when targeted user is not CLIENT role (same null-return path, distinct intent)', async () => {
    const { service, prisma } = buildHarness();
    // The findFirst filter has role: 'CLIENT'. A non-CLIENT user simply
    // does not match → null. This documents the intent that the create
    // path will NOT silently accept an engineer/admin as the project client.
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        superAdmin,
        { name: 'Tower Y', clientId: 'engineer-id' } as never,
        mockReq,
      ),
    ).rejects.toThrow(/العميل|client/i);
  });
});

describe('ProjectsService.findAll — P3, P4 (role-based visibility)', () => {
  it('P3: CLIENT role restricts where.clientId to user.userId', async () => {
    const { service, prisma } = buildHarness();
    prisma.project.findMany.mockResolvedValue([]);
    prisma.project.count.mockResolvedValue(0);

    await service.findAll(client, {} as never);

    const passedWhere = prisma.project.findMany.mock.calls[0][0].where;
    expect(passedWhere).toMatchObject({
      companyId: 'co-A',
      clientId: 'client-1',
    });
    // And the assignment-based filter must NOT be added on a CLIENT path.
    expect(passedWhere.assignments).toBeUndefined();
  });

  it('P4: SITE_ENGINEER role restricts via active assignments', async () => {
    const { service, prisma } = buildHarness();
    prisma.project.findMany.mockResolvedValue([]);
    prisma.project.count.mockResolvedValue(0);

    await service.findAll(engineer, {} as never);

    const passedWhere = prisma.project.findMany.mock.calls[0][0].where;
    expect(passedWhere).toMatchObject({
      companyId: 'co-A',
      assignments: { some: { userId: 'eng-1', removedAt: null } },
    });
    // And the CLIENT short-circuit must NOT trigger.
    expect(passedWhere.clientId).toBeUndefined();
  });
});

describe('ProjectsService.changeStatus — P5, P6 (state machine + paired audit)', () => {
  it('P5: rejects invalid transition (DRAFT → COMPLETED)', async () => {
    const { service, prisma } = buildHarness();
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1', status: 'DRAFT', companyId: 'co-A',
    });

    await expect(
      service.changeStatus(
        superAdmin,
        'proj-1',
        { status: 'COMPLETED' } as never,
        mockReq,
      ),
    ).rejects.toThrow(/الانتقال|transition|COMPLETED/);
  });

  it(
    'P6: CANCELLED writes audit DELETE with reason + correct old/new — ' +
      'PAIRED-ASSERTION on the deepest primary action (rule #4)',
    async () => {
      const { service, prisma, auditLog } = buildHarness();
      prisma.project.findFirst.mockResolvedValue({
        id: 'proj-1', status: 'IN_PROGRESS', companyId: 'co-A',
        name: 'Tower-1',
      });
      prisma.project.update.mockResolvedValue({
        id: 'proj-1', status: 'CANCELLED',
      });

      const reason = 'client withdrew funding mid-build — formal letter on file';
      await service.changeStatus(
        superAdmin,
        'proj-1',
        { status: 'CANCELLED', reason } as never,
        mockReq,
      );

      // DEEPEST primary action: the audit row, not the project.status flip.
      // Surface-only would be `prisma.project.update called with status:
      // CANCELLED` — we explicitly avoid that surface here (CVE-TEST-011
      // lesson: don't pair side-effect on a shallow proxy).
      expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
      expect(auditLog.logInTransaction).toHaveBeenCalledWith(
        expect.any(Object), // tx (mock-equal-to-prisma in this harness)
        expect.objectContaining({
          companyId: 'co-A',
          userId: 'sa-1',
          userRole: 'SUPER_ADMIN',
          entityType: 'project',
          entityId: 'proj-1',
          action: AuditAction.DELETE,            // ← CANCELLED maps to DELETE
          oldValues: { status: 'IN_PROGRESS' },
          newValues: { status: 'CANCELLED' },
          reason,                                // ← exact string, not just "≥20 chars"
        }),
      );
    },
  );
});

describe('ProjectsService.softDelete — P7 (negative-action reason guard)', () => {
  it('P7: rejects reason shorter than 20 characters', async () => {
    const { service, prisma } = buildHarness();
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1', status: 'DRAFT', companyId: 'co-A', name: 'X',
    });

    await expect(
      service.softDelete(superAdmin, 'proj-1', 'too short', mockReq),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ProjectsService.assignMember — P8 (F1 role gate)', () => {
  it('P8: rejects when targeted user is CLIENT/PM/SUPER_ADMIN (F1 staff-only)', async () => {
    const { service, prisma } = buildHarness();
    // getOwnedProject — project lookup OK.
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1', companyId: 'co-A', name: 'X',
    });
    // user.findFirst with `role: { in: [SITE_ENGINEER, SUPERVISOR,
    // ACCOUNTANT, WORKER] }` — a CLIENT or admin would not match.
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.assignMember(
        superAdmin,
        'proj-1',
        { userId: 'client-1', roleInProject: 'WORKER' } as never,
        mockReq,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    // The role gate must be applied at the lookup. PAIRED-ASSERTION: the
    // surface is the rejection, the deepest representable action is the
    // exact `role: { in: [...] }` filter shape.
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'co-A',
          role: { in: ['SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER'] },
        }),
      }),
    );
  });
});

// ────────────────────────────────────────────────────────────
// ensureProjectAccess (6 specs — CVE-PROJ-001 + A2 closure)
// ────────────────────────────────────────────────────────────

describe('ProjectsService.ensureProjectAccess — CVE-PROJ-001 + A2', () => {
  it('EA1: SUPER_ADMIN of company A passing a company-B projectId → Forbidden', async () => {
    const { service, prisma } = buildHarness();
    // No matching project for the (id, companyId=co-A, not-deleted) filter
    // — the projectId belongs to another tenant.
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(
      service.ensureProjectAccess(superAdmin, 'cross-tenant-projectId'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // CRITICAL: the lookup MUST be tenant-scoped and soft-delete-filtered
    // EVEN FOR ADMINS. The CVE-PROJ-001 fix lives in this exact filter.
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'cross-tenant-projectId',
          companyId: 'co-A',
          deletedAt: null,
        }),
      }),
    );
  });

  it('EA2: PROJECT_MANAGER of company A passing a company-B projectId → Forbidden', async () => {
    const { service, prisma } = buildHarness();
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(
      service.ensureProjectAccess(pm, 'cross-tenant-projectId'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('EA3: SUPER_ADMIN within own company + not-deleted → resolves (no throw)', async () => {
    const { service, prisma } = buildHarness();
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1', clientId: 'client-1',
    });

    await expect(
      service.ensureProjectAccess(superAdmin, 'proj-1'),
    ).resolves.toBeUndefined();

    // Admins MUST NOT short-circuit before the tenant lookup.
    expect(prisma.project.findFirst).toHaveBeenCalledTimes(1);
    // And no assignment lookup is needed on the admin path.
    expect(prisma.projectAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('EA4: SUPER_ADMIN within own company but project is soft-deleted → Forbidden (A2 closure)', async () => {
    const { service, prisma } = buildHarness();
    // From the mock's view, "deleted" and "not found" produce the same
    // null return because the softDeleteFilter is part of the WHERE clause.
    // We assert on the *filter shape* — deletedAt: null must be present —
    // which is how the production code enforces A2.
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(
      service.ensureProjectAccess(superAdmin, 'soft-deleted-projId'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('EA5: CLIENT accessing a project they do not own (same company) → Forbidden', async () => {
    const { service, prisma } = buildHarness();
    // Same-company project, but owned by a different CLIENT.
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1', clientId: 'OTHER-client-id',
    });

    await expect(
      service.ensureProjectAccess(client, 'proj-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // No assignment lookup on the CLIENT path either.
    expect(prisma.projectAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('EA6: SITE_ENGINEER with no active assignment on the project → Forbidden', async () => {
    const { service, prisma } = buildHarness();
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1', clientId: 'someone-else',
    });
    prisma.projectAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.ensureProjectAccess(engineer, 'proj-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // The assignment check MUST require removedAt: null (active only).
    expect(prisma.projectAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'proj-1', userId: 'eng-1', removedAt: null },
      }),
    );
  });
});
