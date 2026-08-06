// ============================================
// Prisma mock utility — Session 1.5 MVT infrastructure
//
// What this gives the test author:
//   - jest.fn() for every Prisma method touched by auth/users/companies
//     services (user.*, company.*).
//   - A `$transaction` that simply invokes the callback with the same mock
//     object as `tx`. This is enough to assert "method X was called inside
//     a transaction" because callers do
//        `await this.prisma.$transaction(async (tx) => { ... tx.user.update(...) })`
//     and `tx.user.update === prisma.user.update` here. It does NOT model
//     real transaction isolation or rollback; integration tests do that.
//   - `softDeleteFilter` getter that matches the real PrismaService.
//
// What this does NOT give you:
//   - Any model not in user/company. Add fields as new specs need them
//     rather than mocking the whole 18-model schema upfront.
//   - Type-safe assertion on Prisma's generated input types — the mocks
//     return `unknown`-typed jest.fn() and you cast at the call site.
// ============================================

export interface MockPrismaModel {
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  count: jest.Mock;
}

export interface MockPrisma {
  user: MockPrismaModel;
  company: MockPrismaModel;
  project: MockPrismaModel;
  phase: MockPrismaModel;
  projectAssignment: MockPrismaModel;
  update: MockPrismaModel;
  $transaction: jest.Mock;
  softDeleteFilter: { deletedAt: null };
}

function makeModel(): MockPrismaModel {
  return {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };
}

/**
 * Build a fresh PrismaService mock. Call once per `beforeEach` — never
 * share an instance across tests (jest.fn() state would leak).
 *
 * Cast at the construction site:
 *   const prisma = createMockPrisma();
 *   const service = new UsersService(prisma as unknown as PrismaService, ...);
 */
export function createMockPrisma(): MockPrisma {
  const prisma: MockPrisma = {
    user: makeModel(),
    company: makeModel(),
    project: makeModel(),
    phase: makeModel(),
    projectAssignment: makeModel(),
    update: makeModel(),
    // The callback receives the SAME mock as `tx`. Assertions on
    // `prisma.user.update` will match calls made via `tx.user.update`.
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return (input as (tx: MockPrisma) => Promise<unknown>)(prisma);
      }
      // Array form: $transaction([promiseA, promiseB]) — resolve them all.
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return undefined;
    }),
    softDeleteFilter: { deletedAt: null },
  };
  return prisma;
}
