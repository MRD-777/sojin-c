// ============================================
// Finance DTOs — MVT (S7)
//
//   MVT-13 CVE-S7-001 — `order` is bounded below INT4, asserted from both
//          sides (the limit passes, one past it fails).
//   MVT-14 CVE-S7-002 — a whitespace-only name is rejected.
//
// These assert at the validation layer, before any value reaches Prisma —
// the same rules the global ValidationPipe applies in production
// (`whitelist: true`, `forbidNonWhitelisted: true`).
// ============================================
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  CreateBOQItemDto,
  UpdateBOQItemDto,
  UpdateFinancialSettingsDto,
} from './index';

type Ctor<T> = new () => T;

async function check<T extends object>(
  cls: Ctor<T>,
  input: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validate(plainToInstance(cls, input) as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

const failedOn = (errors: ValidationError[], field: string): boolean =>
  errors.some((e) => e.property === field);

describe('Finance DTOs', () => {
  // ─── MVT-13 ──────────────────────────────────────────────
  describe('MVT-13 — CVE-S7-001: `order` upper bound (INT4 overflow)', () => {
    const ORDER_MAX = 1_000_000;

    it('accepts the boundary value itself', async () => {
      expect(
        await check(CreateBOQItemDto, {
          name: 'بند',
          contractValue: 10,
          order: ORDER_MAX,
        }),
      ).toEqual([]);
    });

    it.each([ORDER_MAX + 1, 2_147_483_648, 9_999_999_999])(
      'rejects %s before it can reach an INTEGER column',
      async (order) => {
        const errors = await check(CreateBOQItemDto, {
          name: 'بند',
          contractValue: 10,
          order,
        });
        expect(failedOn(errors, 'order')).toBe(true);
        expect(errors[0].constraints).toHaveProperty('max');
      },
    );

    it('applies the same bound on PATCH, not only on create', async () => {
      const errors = await check(UpdateBOQItemDto, { order: 2_147_483_648 });
      expect(failedOn(errors, 'order')).toBe(true);
    });

    it('still rejects a negative order', async () => {
      const errors = await check(CreateBOQItemDto, {
        name: 'بند',
        contractValue: 10,
        order: -1,
      });
      expect(failedOn(errors, 'order')).toBe(true);
    });
  });

  // ─── MVT-14 ──────────────────────────────────────────────
  describe('MVT-14 — CVE-S7-002: whitespace-only name', () => {
    it.each(['   ', '\t', '\n  \t ', ''])(
      'rejects a name made only of whitespace (%j)',
      async (name) => {
        const errors = await check(CreateBOQItemDto, {
          name,
          contractValue: 10,
        });
        expect(failedOn(errors, 'name')).toBe(true);
      },
    );

    it('accepts a real name, including one with surrounding spaces', async () => {
      expect(
        await check(CreateBOQItemDto, {
          name: '  أعمال الحفر  ',
          contractValue: 10,
        }),
      ).toEqual([]);
    });

    it('applies the same rule on PATCH', async () => {
      expect(failedOn(await check(UpdateBOQItemDto, { name: '   ' }), 'name')).toBe(
        true,
      );
      expect(await check(UpdateBOQItemDto, { name: 'اسم صحيح' })).toEqual([]);
    });
  });

  // ─── Money / percentage bounds (regression net) ──────────
  describe('money and percentage bounds', () => {
    it('rejects negative money and percentages above 100', async () => {
      expect(
        failedOn(
          await check(UpdateFinancialSettingsDto, { contractValue: -1 }),
          'contractValue',
        ),
      ).toBe(true);
      expect(
        failedOn(
          await check(UpdateFinancialSettingsDto, { retentionPct: 100.01 }),
          'retentionPct',
        ),
      ).toBe(true);
      expect(
        failedOn(
          await check(UpdateFinancialSettingsDto, { advancePct: -0.01 }),
          'advancePct',
        ),
      ).toBe(true);
    });

    it('rejects more than two decimal places on money', async () => {
      expect(
        failedOn(
          await check(UpdateFinancialSettingsDto, { contractValue: 10.005 }),
          'contractValue',
        ),
      ).toBe(true);
    });

    it('accepts retentionPct = 100 — registered by the hacker, deliberately NOT blocked', async () => {
      // Documented decision: the ceiling is a contractual number, not a gate.
      // The action is fully audited instead. This spec pins the CURRENT
      // behaviour so a future silent cap cannot slip in unnoticed.
      expect(
        await check(UpdateFinancialSettingsDto, { retentionPct: 100 }),
      ).toEqual([]);
    });

    it('rejects unknown properties (mass-assignment defense)', async () => {
      const errors = await check(UpdateFinancialSettingsDto, {
        contractValue: 10,
        netDue: 999999, // not a settable field — computed per-request
      });
      expect(failedOn(errors, 'netDue')).toBe(true);
    });
  });
});
