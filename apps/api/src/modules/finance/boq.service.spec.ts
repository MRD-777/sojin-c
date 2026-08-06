// ============================================
// BOQService — MVT (S7)
//
// Covers:
//   MVT-7  soft-delete: `delete()` is NEVER called; deletedAt/deletedBy set.
//   MVT-8  CVE conflict resolution: a reason-less DELETE succeeds, the row
//          keeps the user's raw reason (null), the audit gets the declared text.
//   MVT-9  active-children guard: 400 + zero writes / all-deleted ⇒ succeeds.
//   MVT-10 completedPct: APPROVED-only population, divide-by-zero, 100% cap.
//   MVT-11 🔴 IDOR, BOTH directions:
//          (a) update from another project ⇒ 404 + no link written, and the
//              query itself carried the project constraint;
//          (b) BOQ item from another tenant ⇒ 404 BEFORE the update is ever
//              touched — this is the link in the 2→4 chain the hacker flagged.
//   MVT-16 CVE-S7-004: the children count is scoped by projectId.
//   MVT-17 CVE-S7-005: sub-item depth is bounded, asserted from both sides.
// ============================================
import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BOQService } from './boq.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import type { JwtPayload } from '../../common/decorators';
import type { Request } from 'express';

const { Decimal } = Prisma;

const mockReq = {
  ip: '203.0.113.9',
  headers: { 'user-agent': 'jest' },
} as unknown as Request;

const accountant: JwtPayload = {
  sub: 'sup-acc',
  email: 'acc@co.test',
  userId: 'user-acc',
  companyId: 'co-A',
  role: 'ACCOUNTANT',
  permissions: [],
};

interface ItemShape {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  contractValue: Prisma.Decimal;
  order: number;
}

const item = (over: Partial<ItemShape> = {}): ItemShape => ({
  id: 'boq-1',
  projectId: 'proj-1',
  parentId: null,
  name: 'أعمال الحفر',
  contractValue: new Decimal('1000.00'),
  order: 0,
  ...over,
});

function buildHarness() {
  const bOQItem = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    delete: jest.fn(), // must stay untouched — asserted in MVT-7
  };
  const bOQItemUpdate = {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
  };
  const updateModel = { findFirst: jest.fn() };
  const project = { findFirst: jest.fn().mockResolvedValue({ id: 'proj-1' }) };

  const prisma: Record<string, unknown> = {
    bOQItem,
    bOQItemUpdate,
    update: updateModel,
    project,
    softDeleteFilter: { deletedAt: null },
    $transaction: jest.fn(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : arg,
    ),
  };
  prisma.runSerializable = jest.fn(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  );

  const audit = {
    logInTransaction: jest.fn().mockResolvedValue(undefined),
    log: jest.fn(),
  };
  const ensureProjectAccess = jest.fn().mockResolvedValue(undefined);

  const service = new BOQService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditLogService,
    { ensureProjectAccess } as unknown as ProjectsService,
  );

  return {
    service,
    bOQItem,
    bOQItemUpdate,
    updateModel,
    project,
    audit,
    ensureProjectAccess,
    prisma,
  };
}

describe('BOQService', () => {
  // ─── MVT-7 ───────────────────────────────────────────────
  describe('MVT-7 — soft delete', () => {
    const reason = 'تم إلغاء هذا البند من نطاق العقد بعد الاتفاق مع العميل';

    it('NEVER calls delete() and stamps deletedAt/deletedBy/reason', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item());
      h.bOQItem.count.mockResolvedValue(0);
      h.bOQItem.update.mockResolvedValue({
        ...item(),
        deletedAt: new Date('2026-08-03T10:00:00.000Z'),
        deletionReason: reason,
      });

      const res = await h.service.softDelete(
        accountant,
        'boq-1',
        { reason },
        mockReq,
      );

      // THE paired assertion — hard delete on a priced record is forbidden.
      expect(h.bOQItem.delete).not.toHaveBeenCalled();

      const args = h.bOQItem.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: 'boq-1' });
      expect(args.data.deletedAt).toBeInstanceOf(Date);
      expect(args.data.deletedBy).toBe('user-acc');
      expect(args.data.deletionReason).toBe(reason);

      const entry = h.audit.logInTransaction.mock.calls[0][1];
      expect(entry.entityType).toBe('boq_item');
      expect(entry.action).toBe('DELETE');
      expect(entry.newValues).toBeNull();
      expect(entry.oldValues).toEqual({
        name: 'أعمال الحفر',
        contractValue: '1000.00',
        order: 0,
        parentId: null,
        projectId: 'proj-1',
      });
      expect(entry.reason).toBe(reason);
      expect(res.deletedAt).toBe('2026-08-03T10:00:00.000Z');
    });
  });

  // ─── MVT-8 ───────────────────────────────────────────────
  describe('MVT-8 — reason-less delete (plan #3 vs audit contract)', () => {
    const declared =
      'حذف بند من جدول الكميات (السبب اختياري لبنود المقايسة)';

    it('succeeds with NO reason: row keeps null, audit gets the declared text', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item());
      h.bOQItem.update.mockResolvedValue({
        ...item(),
        deletedAt: new Date('2026-08-03T10:00:00.000Z'),
        deletionReason: null,
      });

      const res = await h.service.softDelete(accountant, 'boq-1', {}, mockReq);

      // The row records exactly what the user typed: nothing.
      expect(h.bOQItem.update.mock.calls[0][0].data.deletionReason).toBeNull();
      // The audit satisfies the ≥20-char contract WITHOUT inventing a motive.
      const entry = h.audit.logInTransaction.mock.calls[0][1];
      expect(entry.reason).toBe(declared);
      expect(entry.reason.trim().length).toBeGreaterThanOrEqual(20);
      expect(res.deletionReason).toBeNull();
    });

    it('keeps a SHORT user reason verbatim in the row and appends it in the audit', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item());
      h.bOQItem.update.mockResolvedValue({
        ...item(),
        deletedAt: new Date(),
        deletionReason: 'خطأ',
      });

      await h.service.softDelete(
        accountant,
        'boq-1',
        { reason: 'خطأ' },
        mockReq,
      );

      expect(h.bOQItem.update.mock.calls[0][0].data.deletionReason).toBe('خطأ');
      const entry = h.audit.logInTransaction.mock.calls[0][1];
      expect(entry.reason).toBe(`${declared} | سبب المستخدم: خطأ`);
      expect(entry.reason.trim().length).toBeGreaterThanOrEqual(20);
    });

    it('uses a long user reason as-is (no prefix)', async () => {
      const h = buildHarness();
      const long = 'تم حذف البند بعد مراجعة النطاق مع الاستشاري وإقرار التعديل';
      h.bOQItem.findFirst.mockResolvedValue(item());
      h.bOQItem.update.mockResolvedValue({
        ...item(),
        deletedAt: new Date(),
        deletionReason: long,
      });

      await h.service.softDelete(
        accountant,
        'boq-1',
        { reason: long },
        mockReq,
      );

      expect(h.audit.logInTransaction.mock.calls[0][1].reason).toBe(long);
    });
  });

  // ─── MVT-9 + MVT-16 ──────────────────────────────────────
  describe('MVT-9 — active children guard', () => {
    it('refuses (400) while an active child exists and writes NOTHING', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item());
      h.bOQItem.count.mockResolvedValue(1);

      await expect(
        h.service.softDelete(accountant, 'boq-1', {}, mockReq),
      ).rejects.toBeInstanceOf(BadRequestException);

      // PAIRED: a 400 that still wrote would be worse than no guard at all.
      expect(h.bOQItem.update).not.toHaveBeenCalled();
      expect(h.bOQItem.delete).not.toHaveBeenCalled();
      expect(h.audit.logInTransaction).not.toHaveBeenCalled();
    });

    it('allows deletion when every child is already soft-deleted', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item());
      h.bOQItem.count.mockResolvedValue(0); // live children only
      h.bOQItem.update.mockResolvedValue({
        ...item(),
        deletedAt: new Date(),
        deletionReason: null,
      });

      await expect(
        h.service.softDelete(accountant, 'boq-1', {}, mockReq),
      ).resolves.toBeDefined();
      expect(h.bOQItem.update).toHaveBeenCalledTimes(1);
    });

    it('MVT-16 — CVE-S7-004: the count is scoped by projectId (not just parentId)', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item());
      h.bOQItem.count.mockResolvedValue(0);
      h.bOQItem.update.mockResolvedValue({
        ...item(),
        deletedAt: new Date(),
        deletionReason: null,
      });

      await h.service.softDelete(accountant, 'boq-1', {}, mockReq);

      // Asserting only the 400/200 outcome would pass even with the fix
      // reverted — the argument itself is the evidence.
      expect(h.bOQItem.count).toHaveBeenCalledWith({
        where: { parentId: 'boq-1', projectId: 'proj-1', deletedAt: null },
      });
    });
  });

  // ─── MVT-10 ──────────────────────────────────────────────
  describe('MVT-10 — completedPct', () => {
    it('counts only APPROVED live updates, guards ÷0, and caps at 100%', async () => {
      const h = buildHarness();
      h.bOQItem.findMany.mockResolvedValue([
        item({ id: 'A', contractValue: new Decimal('1000.00') }),
        item({ id: 'B', contractValue: new Decimal('0.00') }),
        item({ id: 'C', contractValue: new Decimal('100.00') }),
      ]);
      h.bOQItemUpdate.findMany.mockResolvedValue([
        { boqItemId: 'A', update: { cost: new Decimal('250.00') } },
        { boqItemId: 'A', update: { cost: new Decimal('250.00') } },
        { boqItemId: 'C', update: { cost: new Decimal('500.00') } },
      ]);

      const res = await h.service.findTree(accountant, 'proj-1');
      const byId = Object.fromEntries(res.items.map((i) => [i.id, i]));

      expect(byId.A.completedValue).toBe('500.00');
      expect(byId.A.completedPct).toBe('50.00');
      // contractValue = 0 ⇒ 0%, never a division by zero.
      expect(byId.B.completedPct).toBe('0.00');
      // Over-delivery is capped — a 500% progress bar is not actionable.
      expect(byId.C.completedPct).toBe('100.00');
      expect(byId.C.completedValue).toBe('500.00');
    });

    it('excludes non-APPROVED / deleted / foreign rows IN THE QUERY', async () => {
      const h = buildHarness();
      h.bOQItem.findMany.mockResolvedValue([item()]);

      await h.service.findTree(accountant, 'proj-1');

      // The exclusion happens in the DB, so the where-clause IS the deepest
      // representable evidence that PENDING/REJECTED never reach the sum.
      const where = h.bOQItemUpdate.findMany.mock.calls[0][0].where;
      expect(where.update.status).toBe('APPROVED');
      expect(where.update.deletedAt).toBeNull();
      expect(where.update.phase.deletedAt).toBeNull();
      expect(where.update.phase.project).toEqual({
        id: 'proj-1',
        companyId: 'co-A',
        deletedAt: null,
      });
      expect(where.boqItem).toEqual({
        projectId: 'proj-1',
        deletedAt: null,
        project: { companyId: 'co-A', deletedAt: null },
      });
    });

    it('nests children under their parent and keeps orphans as roots', async () => {
      const h = buildHarness();
      h.bOQItem.findMany.mockResolvedValue([
        item({ id: 'root', parentId: null }),
        item({ id: 'child', parentId: 'root' }),
        item({ id: 'orphan', parentId: 'vanished' }),
      ]);

      const res = await h.service.findTree(accountant, 'proj-1');

      expect(res.items.map((i) => i.id)).toEqual(['root', 'orphan']);
      const root = res.items.find((i) => i.id === 'root')!;
      expect(root.children.map((c) => c.id)).toEqual(['child']);
      // A priced orphan is surfaced, never silently dropped from the total.
      expect(res.items.find((i) => i.id === 'orphan')!.contractValue).toBe(
        '1000.00',
      );
    });
  });

  // ─── MVT-11 🔴 IDOR ──────────────────────────────────────
  describe('MVT-11 — cross-project / cross-tenant link (IDOR)', () => {
    it('(a) an update from another project ⇒ 404 and NO link is written', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item({ projectId: 'proj-1' }));
      // The scoped lookup finds nothing — a foreign update does not EXIST
      // for this query.
      h.updateModel.findFirst.mockResolvedValue(null);

      await expect(
        h.service.linkUpdate(
          accountant,
          'boq-1',
          { updateId: 'upd-from-proj-2' },
          mockReq,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(h.bOQItemUpdate.create).not.toHaveBeenCalled();
      expect(h.audit.logInTransaction).not.toHaveBeenCalled();

      // 🔑 Without this, the spec would still pass if the constraint were
      // deleted from the where-clause (the mock returns null regardless).
      const where = h.updateModel.findFirst.mock.calls[0][0].where;
      expect(where.id).toBe('upd-from-proj-2');
      expect(where.deletedAt).toBeNull();
      expect(where.phase.deletedAt).toBeNull();
      expect(where.phase.project.id).toBe('proj-1'); // ← the cross-project gate
      expect(where.phase.project.companyId).toBe('co-A'); // ← the tenant gate
      expect(where.phase.project.deletedAt).toBeNull();
    });

    it('(b) a BOQ item from another tenant ⇒ 404 BEFORE the update is touched', async () => {
      const h = buildHarness();
      // readItem is tenant-scoped, so a foreign item is simply absent.
      h.bOQItem.findFirst.mockResolvedValue(null);

      await expect(
        h.service.linkUpdate(
          accountant,
          'boq-of-company-B',
          { updateId: 'upd-1' },
          mockReq,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      // 🔑 The 2→4 chain: layer 4 constrains the update to
      // `boqItem.projectId`, so layer 2 is what guarantees that input is not
      // a foreign tenant's project. If the item read ever stopped being
      // scoped, layer 4 would faithfully scope to the WRONG company.
      expect(h.updateModel.findFirst).not.toHaveBeenCalled();
      expect(h.bOQItemUpdate.create).not.toHaveBeenCalled();

      const where = h.bOQItem.findFirst.mock.calls[0][0].where;
      expect(where.deletedAt).toBeNull();
      expect(where.project).toEqual({ companyId: 'co-A', deletedAt: null });
    });

    it('rejects a non-APPROVED update with 400 and writes nothing', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item());
      h.updateModel.findFirst.mockResolvedValue({
        id: 'upd-1',
        status: 'PENDING',
        cost: new Decimal('500.00'),
        phase: { projectId: 'proj-1' },
      });

      await expect(
        h.service.linkUpdate(accountant, 'boq-1', { updateId: 'upd-1' }, mockReq),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(h.bOQItemUpdate.create).not.toHaveBeenCalled();
    });

    it('links a same-project APPROVED update and audits the imported cost', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item());
      h.updateModel.findFirst.mockResolvedValue({
        id: 'upd-1',
        status: 'APPROVED',
        cost: new Decimal('750.00'),
        phase: { projectId: 'proj-1' },
      });
      h.bOQItemUpdate.findUnique.mockResolvedValue(null);
      h.bOQItemUpdate.create.mockResolvedValue({ id: 'link-1' });

      const res = await h.service.linkUpdate(
        accountant,
        'boq-1',
        { updateId: 'upd-1' },
        mockReq,
      );

      expect(h.bOQItemUpdate.create).toHaveBeenCalledWith({
        data: { boqItemId: 'boq-1', updateId: 'upd-1' },
        select: { id: true },
      });
      const entry = h.audit.logInTransaction.mock.calls[0][1];
      expect(entry.entityType).toBe('boq_item_update');
      expect(entry.action).toBe('CREATE');
      expect(entry.newValues).toEqual({
        boqItemId: 'boq-1',
        updateId: 'upd-1',
        projectId: 'proj-1',
        updateCost: '750.00',
      });
      expect(res.alreadyLinked).toBe(false);
    });

    it('is idempotent on a duplicate link — no second audit entry', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item());
      h.updateModel.findFirst.mockResolvedValue({
        id: 'upd-1',
        status: 'APPROVED',
        cost: new Decimal('750.00'),
        phase: { projectId: 'proj-1' },
      });
      h.bOQItemUpdate.findUnique.mockResolvedValue({ id: 'link-existing' });

      const res = await h.service.linkUpdate(
        accountant,
        'boq-1',
        { updateId: 'upd-1' },
        mockReq,
      );

      expect(res.alreadyLinked).toBe(true);
      expect(h.bOQItemUpdate.create).not.toHaveBeenCalled();
      expect(h.audit.logInTransaction).not.toHaveBeenCalled();
    });
  });

  // ─── MVT-17 ──────────────────────────────────────────────
  describe('MVT-17 — CVE-S7-005 sub-item depth bound', () => {
    it('refuses a sub-item deeper than 10 ancestors and creates nothing', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item({ id: 'deep-parent' }));
      // An endless ancestor chain — the walk must stop at the limit.
      h.bOQItem.findUnique.mockResolvedValue({ parentId: 'another-ancestor' });

      await expect(
        h.service.createSubItem(
          accountant,
          'deep-parent',
          { name: 'تفريعة', contractValue: 100 },
          mockReq,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(h.bOQItem.create).not.toHaveBeenCalled();
      expect(h.audit.logInTransaction).not.toHaveBeenCalled();
      // The walk is bounded — it does not chase the chain forever.
      expect(h.bOQItem.findUnique).toHaveBeenCalledTimes(10);
    });

    it('accepts a sub-item within the limit (two-sided bound)', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(item({ id: 'shallow-parent' }));
      let hop = 0;
      h.bOQItem.findUnique.mockImplementation(async () => {
        hop += 1;
        return { parentId: hop >= 9 ? null : `ancestor-${hop}` };
      });
      h.bOQItem.create.mockResolvedValue(
        item({ id: 'new-child', parentId: 'shallow-parent' }),
      );

      const res = await h.service.createSubItem(
        accountant,
        'shallow-parent',
        { name: 'تفريعة', contractValue: 100 },
        mockReq,
      );

      expect(h.bOQItem.create).toHaveBeenCalledTimes(1);
      expect(res.parentId).toBe('shallow-parent');
    });

    it('derives projectId from the PARENT — never from the request', async () => {
      const h = buildHarness();
      h.bOQItem.findFirst.mockResolvedValue(
        item({ id: 'parent', projectId: 'proj-parent' }),
      );
      h.bOQItem.findUnique.mockResolvedValue({ parentId: null });
      h.bOQItem.create.mockResolvedValue(
        item({ id: 'kid', parentId: 'parent', projectId: 'proj-parent' }),
      );

      await h.service.createSubItem(
        accountant,
        'parent',
        { name: 'تفريعة', contractValue: 100 },
        mockReq,
      );

      const data = h.bOQItem.create.mock.calls[0][0].data;
      expect(data.projectId).toBe('proj-parent');
      expect(data.parentId).toBe('parent');
      expect(h.ensureProjectAccess).toHaveBeenCalledWith(
        accountant,
        'proj-parent',
      );
    });
  });
});
