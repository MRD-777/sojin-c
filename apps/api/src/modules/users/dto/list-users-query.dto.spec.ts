// ============================================
// ListUsersQueryDto — sortBy whitelist (A6 regression net)
//
// Session 1's A6 fix narrowed `sortBy` from a free-form `@IsString()` to a
// whitelist (USER_SORT_COLUMNS) to close the ordering-oracle vector that
// let a caller leak supabaseAuthId bits via paginated diff.
//
// These specs assert at the DTO validation layer, before the value
// reaches Prisma. ValidationPipe enforces the same rules in production.
// ============================================
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ListUsersQueryDto } from './index';

async function validateQuery(input: Record<string, unknown>): Promise<ValidationError[]> {
  const dto = plainToInstance(ListUsersQueryDto, input);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('ListUsersQueryDto.sortBy whitelist (A6)', () => {
  // ─── Allowed values ──────────────────────────────────────
  const ALLOWED = ['name', 'email', 'role', 'createdAt', 'lastLogin'];

  it.each(ALLOWED)('accepts sortBy=%s', async (sortBy) => {
    const errors = await validateQuery({ sortBy });
    expect(errors).toEqual([]);
  });

  it('accepts the default (no sortBy provided) — defaults to createdAt at runtime', async () => {
    const errors = await validateQuery({});
    expect(errors).toEqual([]);
  });

  it('accepts sortBy together with sortOrder', async () => {
    const errors = await validateQuery({ sortBy: 'name', sortOrder: 'asc' });
    expect(errors).toEqual([]);
  });

  // ─── Rejected values — the actual ordering-oracle vectors ────
  it('REJECTS sortBy=supabaseAuthId (the original leak vector)', async () => {
    const errors = await validateQuery({ sortBy: 'supabaseAuthId' });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('sortBy');
    // The error must come from @IsIn — not @IsString — so we know the
    // whitelist is what rejected it (not the type check).
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  it.each(['id', 'companyId', 'customPermissions', 'phone', 'deletedAt'])(
    'rejects sortBy=%s (not in whitelist)',
    async (sortBy) => {
      const errors = await validateQuery({ sortBy });
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isIn');
    },
  );

  it('rejects sortOrder=sideways (sanity check on the inherited PaginationDto)', async () => {
    const errors = await validateQuery({ sortBy: 'name', sortOrder: 'sideways' });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });
});
