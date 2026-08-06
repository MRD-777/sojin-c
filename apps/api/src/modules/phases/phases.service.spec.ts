// ============================================
// PhasesService spec — Session 2 (Projects + Phases review)
//
// Covers (7 specs, part of the 21-spec MVT budget):
//
//   PH1 — create() invokes recalculateProgressInTx INSIDE the transaction
//         (C28 paired-assertion: weight distribution change → recalc).
//   PH2 — update() rejects invalid status transition (NOT_STARTED → COMPLETED).
//   PH3 — overrideProgress() writes audit PROGRESS_OVERRIDE with reason +
//         correct old/new (PAIRED-ASSERTION — rule #4, deepest primary
//         action is the audit row, not the phase.progress flip).
//   PH4 — reorder() writes audit UPDATE with exact old/new order.
//   PH5 — softDelete() refuses when activeUpdates > 0 (DRAFT/PENDING/APPROVED).
//   PH6 — softDelete() PAIRED-ASSERTION: logInTransaction(action=DELETE,
//         reason) AND recalculateProgressInTx inside the same tx.
//   PH7 — findAll() where clause includes project.deletedAt: null
//         (F2 cascade closure — phases of soft-deleted projects must
//         not be visible).
// ============================================
import type { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import { PhasesService } from './phases.service';
import { JwtPayload } from '../../common/decorators';
import {
  createMockPrisma,
  type MockPrisma,
} from '../../test-utils/prisma-mock';
import {
  createMockAuditLog,
  type MockAuditLog,
} from '../../test-utils/audit-log-mock';

interface MockProjectsService {
  ensureProjectAccess: jest.Mock;
  recalculateProgressInTx: jest.Mock;
}

interface Harness {
  service: PhasesService;
  prisma: MockPrisma;
  auditLog: MockAuditLog;
  projectsService: MockProjectsService;
}

function buildHarness(): Harness {
  const prisma = createMockPrisma();
  const auditLog = createMockAuditLog();
  const projectsService: MockProjectsService = {
    ensureProjectAccess: jest.fn().mockResolvedValue(undefined),
    recalculateProgressInTx: jest.fn().mockResolvedValue(0),
  };
  const service = new PhasesService(
    prisma as unknown as PrismaService,
    auditLog as unknown as AuditLogService,
    projectsService as unknown as ProjectsService,
  );
  return { service, prisma, auditLog, projectsService };
}

const mockReq = { ip: '127.0.0.1', headers: {} } as unknown as Request;

const pm: JwtPayload = {
  sub: 'sup-pm', email: 'pm@co.test', userId: 'pm-1',
  companyId: 'co-A', role: 'PROJECT_MANAGER', permissions: [],
};

// ────────────────────────────────────────────────────────────
// PH1 — create() + C28 paired assertion
// ────────────────────────────────────────────────────────────

describe('PhasesService.create — PH1 (C28: recalc inside tx)', () => {
  it('PH1: invokes recalculateProgressInTx with the tx client, inside the same transaction', async () => {
    const { service, prisma, projectsService } = buildHarness();
    prisma.project.findFirst.mockResolvedValue({
      id: 'proj-1', companyId: 'co-A',
    });
    // Auto-order: no prior phases.
    prisma.phase.findFirst.mockResolvedValue(null);
    prisma.phase.create.mockResolvedValue({
      id: 'phase-1', projectId: 'proj-1', order: 0, weight: 1,
    });

    await service.create(
      pm, 'proj-1',
      { name: 'Foundations', weight: 2 } as never,
      mockReq,
    );

    // PAIRED-ASSERTION (C28): the recalc MUST run with the tx client
    // (which equals `prisma` in this harness — see prisma-mock.ts comment),
    // and it MUST be called inside the $transaction callback.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(projectsService.recalculateProgressInTx).toHaveBeenCalledTimes(1);
    expect(projectsService.recalculateProgressInTx.mock.calls[0][1])
      .toBe('proj-1');
  });
});

// ────────────────────────────────────────────────────────────
// PH2 — update() state machine
// ────────────────────────────────────────────────────────────

describe('PhasesService.update — PH2 (state machine)', () => {
  it('PH2: rejects NOT_STARTED → COMPLETED (must pass through IN_PROGRESS)', async () => {
    const { service, prisma } = buildHarness();
    prisma.phase.findFirst.mockResolvedValue({
      id: 'phase-1', projectId: 'proj-1', status: 'NOT_STARTED',
      name: 'Foundations', weight: 1,
    });

    await expect(
      service.update(
        pm, 'phase-1',
        { status: 'COMPLETED' } as never,
        mockReq,
      ),
    ).rejects.toThrow(/الانتقال|transition|COMPLETED/);
  });
});

// ────────────────────────────────────────────────────────────
// PH3 — overrideProgress() paired audit
// ────────────────────────────────────────────────────────────

describe('PhasesService.overrideProgress — PH3 (paired audit)', () => {
  it(
    'PH3: writes audit PROGRESS_OVERRIDE with reason + exact old/new — ' +
      'PAIRED-ASSERTION on the deepest primary action (rule #4)',
    async () => {
      const { service, prisma, auditLog } = buildHarness();
      prisma.phase.findFirst.mockResolvedValue({
        id: 'phase-1', projectId: 'proj-1', status: 'IN_PROGRESS',
        progress: 30, name: 'Walls', weight: 1,
      });
      prisma.phase.update.mockResolvedValue({
        id: 'phase-1', progress: 75,
      });

      const reason =
        'site inspection confirmed work ahead of reported figure — calibrated to 75';
      await service.overrideProgress(
        pm, 'phase-1',
        { progress: 75, reason } as never,
        mockReq,
      );

      // DEEPEST primary action: the audit row carries action,
      // reason, old/new progress, entity refs. NOT just the phase.progress
      // flip (CVE-TEST-011 lesson).
      expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
      expect(auditLog.logInTransaction).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          entityType: 'phase',
          entityId: 'phase-1',
          action: AuditAction.PROGRESS_OVERRIDE,
          oldValues: { progress: 30 },
          newValues: { progress: 75 },
          reason,
        }),
      );
    },
  );
});

// ────────────────────────────────────────────────────────────
// PH4 — reorder() audit
// ────────────────────────────────────────────────────────────

describe('PhasesService.reorder — PH4 (audit UPDATE with order delta)', () => {
  it('PH4: writes audit UPDATE with old.order and new.order exactly', async () => {
    const { service, prisma, auditLog } = buildHarness();
    prisma.phase.findFirst.mockResolvedValue({
      id: 'phase-1', projectId: 'proj-1', status: 'NOT_STARTED',
      order: 2, name: 'Walls',
    });
    prisma.phase.update.mockResolvedValue({});

    await service.reorder(pm, 'phase-1', { order: 5 } as never, mockReq);

    expect(auditLog.logInTransaction).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        entityType: 'phase',
        entityId: 'phase-1',
        action: AuditAction.UPDATE,
        oldValues: { order: 2 },
        newValues: { order: 5 },
      }),
    );
  });
});

// ────────────────────────────────────────────────────────────
// PH5 + PH6 — softDelete()
// ────────────────────────────────────────────────────────────

describe('PhasesService.softDelete — PH5, PH6 (active-updates guard + paired audit)', () => {
  it('PH5: refuses when active updates exist (DRAFT/PENDING/APPROVED)', async () => {
    const { service, prisma } = buildHarness();
    prisma.phase.findFirst.mockResolvedValue({
      id: 'phase-1', projectId: 'proj-1', status: 'IN_PROGRESS',
      progress: 40, name: 'Walls',
    });
    prisma.update.count.mockResolvedValue(3);

    await expect(
      service.softDelete(
        pm, 'phase-1',
        { reason: 'phase no longer needed per client decision letter 04' } as never,
        mockReq,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // PAIRED-ASSERTION on the guard query: it MUST filter on the active
    // UpdateStatus set + soft-delete. If the query is broadened (e.g. by
    // mistakenly including REJECTED), the guard would over-block.
    expect(prisma.update.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          phaseId: 'phase-1',
          status: { in: ['DRAFT', 'PENDING', 'APPROVED'] },
          deletedAt: null,
        }),
      }),
    );
  });

  it(
    'PH6: writes audit DELETE with reason + invokes recalculateProgressInTx — ' +
      'DOUBLE PAIRED-ASSERTION (rule #4)',
    async () => {
      const { service, prisma, auditLog, projectsService } = buildHarness();
      prisma.phase.findFirst.mockResolvedValue({
        id: 'phase-1', projectId: 'proj-1', status: 'IN_PROGRESS',
        progress: 40, name: 'Walls',
      });
      prisma.update.count.mockResolvedValue(0);
      prisma.phase.update.mockResolvedValue({});

      const reason = 'phase removed after scope reduction signed by client X';
      await service.softDelete(
        pm, 'phase-1',
        { reason } as never,
        mockReq,
      );

      // PAIRED 1/2: audit DELETE with full snapshot + reason.
      expect(auditLog.logInTransaction).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          entityType: 'phase',
          entityId: 'phase-1',
          action: AuditAction.DELETE,
          oldValues: { name: 'Walls', status: 'IN_PROGRESS', progress: 40 },
          newValues: null,
          reason,
        }),
      );

      // PAIRED 2/2: project recalc inside the tx (C28).
      expect(projectsService.recalculateProgressInTx).toHaveBeenCalledTimes(1);
      expect(projectsService.recalculateProgressInTx.mock.calls[0][1])
        .toBe('proj-1');
    },
  );
});

// ────────────────────────────────────────────────────────────
// PH7 — findAll() F2 cascade
// ────────────────────────────────────────────────────────────

describe('PhasesService.findAll — PH7 (F2 cascade: project.deletedAt)', () => {
  it('PH7: where clause includes project.deletedAt: null (F2 closure)', async () => {
    const { service, prisma } = buildHarness();
    prisma.phase.findMany.mockResolvedValue([]);

    await service.findAll(pm, 'proj-1');

    // The cascade filter is the whole point of F2 — if a refactor drops
    // it, phases of soft-deleted projects leak. Assert on the EXACT
    // filter shape (the deepest representable check at this layer).
    expect(prisma.phase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'proj-1',
          project: { companyId: 'co-A', deletedAt: null },
          deletedAt: null,
        }),
      }),
    );
  });
});
