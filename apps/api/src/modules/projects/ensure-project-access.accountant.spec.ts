// ============================================
// ensureProjectAccess — ACCOUNTANT company-wide (S7 المرحلة 2)
//
// MVT-12: the Stage 2 widening gave ACCOUNTANT company-wide project access so
// the finance endpoints work without an explicit assignment. This is the
// regression net for that change — and for its boundary: company-wide is NOT
// tenant-wide.
//
// The paired assertion is `projectAssignment.findFirst` never being called:
// a spec that only asserts "resolves" would also pass if the accountant
// happened to be assigned, proving nothing about the early return.
// ============================================
import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TierLimitsService } from '../companies/tier-limits.service';
import { ProjectsService } from './projects.service';
import type { JwtPayload } from '../../common/decorators';
import { createMockPrisma, type MockPrisma } from '../../test-utils/prisma-mock';
import {
  createMockAuditLog,
  type MockAuditLog,
} from '../../test-utils/audit-log-mock';

const accountant: JwtPayload = {
  sub: 'sup-acc',
  email: 'acc@co.test',
  userId: 'user-acc',
  companyId: 'co-A',
  role: 'ACCOUNTANT',
  permissions: [],
};

const siteEngineer: JwtPayload = {
  ...accountant,
  userId: 'user-eng',
  role: 'SITE_ENGINEER',
};

function buildHarness(): {
  service: ProjectsService;
  prisma: MockPrisma;
  auditLog: MockAuditLog;
} {
  const prisma = createMockPrisma();
  const auditLog = createMockAuditLog();
  const tierLimits = { assertCanAddProject: jest.fn() };
  const service = new ProjectsService(
    prisma as unknown as PrismaService,
    auditLog as unknown as AuditLogService,
    tierLimits as unknown as TierLimitsService,
  );
  return { service, prisma, auditLog };
}

describe('MVT-12 — ensureProjectAccess: ACCOUNTANT company-wide', () => {
  it('passes for any project in the same company WITHOUT an assignment', async () => {
    const h = buildHarness();
    h.prisma.project.findFirst.mockResolvedValue({
      id: 'proj-unassigned',
      clientId: 'client-1',
    });

    await expect(
      h.service.ensureProjectAccess(accountant, 'proj-unassigned'),
    ).resolves.toBeUndefined();

    // PAIRED: proves the company-wide early return, not a lucky assignment.
    expect(h.prisma.projectAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('still enforces the tenant boundary — another company is Forbidden', async () => {
    const h = buildHarness();
    // The first lookup is companyId-scoped, so a foreign project is absent.
    h.prisma.project.findFirst.mockResolvedValue(null);

    await expect(
      h.service.ensureProjectAccess(accountant, 'proj-of-company-B'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const where = h.prisma.project.findFirst.mock.calls[0][0].where;
    expect(where.companyId).toBe('co-A');
    expect(where.deletedAt).toBeNull();
    expect(h.prisma.projectAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('does not widen anyone else — SITE_ENGINEER still needs an assignment', async () => {
    const h = buildHarness();
    h.prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      clientId: 'client-1',
    });
    h.prisma.projectAssignment.findFirst.mockResolvedValue(null);

    await expect(
      h.service.ensureProjectAccess(siteEngineer, 'proj-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // The assignment path IS taken for field roles — the widening was
    // scoped to ACCOUNTANT only.
    expect(h.prisma.projectAssignment.findFirst).toHaveBeenCalledTimes(1);
  });

  it('rejects a soft-deleted project even for the widened role', async () => {
    const h = buildHarness();
    h.prisma.project.findFirst.mockResolvedValue(null); // filtered by deletedAt

    await expect(
      h.service.ensureProjectAccess(accountant, 'proj-deleted'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
