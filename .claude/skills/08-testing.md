---
name: testing
description: Use when writing tests, designing test strategy, setting up Jest, mocking Prisma/Supabase, or reviewing PRs for test coverage. Enforces unit tests for business rules, integration tests for endpoints, security tests, multi-tenant isolation tests, and minimum 80% coverage on business logic.
---

# Testing — Safety Rules

> ⚠️ في نظام مالي، test coverage مش اختيار. كل business rule بدون test = bug ينتظر لحظة الـ production.
> القاعدة: **feature ما تتعتبرش "خلصت" غير لما عندها tests تثبت إنها بتعمل اللي المفروض + بترفض اللي مش المفروض**.

---

## 1. Test Pyramid للمشروع

```
              ┌────────────────────┐
              │   E2E / API Tests   │   ← 10% — critical user journeys
              │  (supertest)         │     login → create project →
              └────────────────────┘     submit update → approve
            ┌────────────────────────┐
            │  Integration Tests       │  ← 30% — controller + service + DB
            │  (TestingModule + real   │     لكل endpoint مهم
            │   prisma against test DB)│
            └────────────────────────┘
       ┌────────────────────────────────┐
       │    Unit Tests                    │  ← 60% — pure business logic
       │    (mocked prisma + services)    │     services, validators,
       └────────────────────────────────┘     state machines, calculators
```

**60% unit / 30% integration / 10% e2e** — لا تـ flip الـ pyramid.

---

## 2. Coverage Targets

| الـ Layer | Minimum coverage | السبب |
|---|---|---|
| **Business logic (services)** | **80%** | كل state transition + كل rule |
| **Controllers** | **70%** | كل endpoint + كل role |
| **Guards / Middleware** | **90%** | security critical |
| **Validation (DTOs)** | **90%** | كل validator له test |
| **Common utilities** | **80%** | reused everywhere |
| **Frontend (eventually)** | **60%** | hooks + business components |

في الـ `jest.config.js`:
```typescript
{
  coverageThreshold: {
    global: { branches: 75, functions: 75, lines: 75, statements: 75 },
    './src/modules/**/*.service.ts': { branches: 80, functions: 80, lines: 80, statements: 80 },
    './src/common/guards/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/common/middleware/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
}
```

**CI لازم يفشل لو الـ coverage نزل تحت الـ threshold.**

---

## 3. Unit Tests — Service Level

### Setup الأساسي
```typescript
// payments.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: jest.Mocked<PrismaService>;
  let auditLog: jest.Mocked<AuditLogService>;

  const mockUser = {
    sub: 'supabase-id', email: 'pm@test.com',
    userId: 'user-1', companyId: 'company-1',
    role: 'PROJECT_MANAGER', permissions: [],
  };

  const mockReq = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: {
            payment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
            project: { findFirst: jest.fn() },
            $transaction: jest.fn((cb) => typeof cb === 'function' ? cb(prisma) : Promise.all(cb)),
            softDeleteFilter: { deletedAt: null },
          },
        },
        { provide: AuditLogService, useValue: { log: jest.fn(), logInTransaction: jest.fn() } },
        { provide: ProjectsService, useValue: { ensureProjectAccess: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
    prisma = moduleRef.get(PrismaService);
    auditLog = moduleRef.get(AuditLogService);
  });
});
```

### كل business rule = test

✅ صح:
```typescript
describe('create()', () => {
  const validDto = {
    projectId: 'proj-1',
    amount: 1000,
    type: 'CLIENT_PAYMENT' as const,
    method: 'BANK_TRANSFER' as const,
    date: '2026-05-12',
    description: 'دفعة أولى',
  };

  it('creates payment when input is valid', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', companyId: 'company-1' } as any);
    prisma.payment.create.mockResolvedValue({ id: 'pay-1', ...validDto } as any);

    const result = await service.create(mockUser, validDto, mockReq);

    expect(result.id).toBe('pay-1');
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 1000 }) }),
    );
    expect(auditLog.logInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'CREATE', entityType: 'payment' }),
    );
  });

  it('rejects negative amounts', async () => {
    await expect(
      service.create(mockUser, { ...validDto, amount: -100 }, mockReq),
    ).rejects.toThrow(/المبلغ/);
  });

  it('rejects amounts exceeding max', async () => {
    await expect(
      service.create(mockUser, { ...validDto, amount: 1_000_000_000 }, mockReq),
    ).rejects.toThrow(/الحد المسموح/);
  });

  it('rejects when project belongs to different company', async () => {
    prisma.project.findFirst.mockResolvedValue(null);  // returned empty

    await expect(service.create(mockUser, validDto, mockReq))
      .rejects.toThrow(NotFoundException);
  });

  it('logs audit entry inside the same transaction', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', companyId: 'company-1' } as any);
    prisma.payment.create.mockResolvedValue({ id: 'pay-1', ...validDto } as any);

    await service.create(mockUser, validDto, mockReq);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(auditLog.logInTransaction).toHaveBeenCalled();   // ✅ logInTransaction مش log
    expect(auditLog.log).not.toHaveBeenCalled();
  });
});
```

### Tests للـ State Machines
كل transition + كل invalid transition = test.

```typescript
describe('Update state machine', () => {
  it.each([
    { from: 'DRAFT', to: 'PENDING', allowed: true },
    { from: 'DRAFT', to: 'APPROVED', allowed: false },
    { from: 'PENDING', to: 'APPROVED', allowed: true },
    { from: 'PENDING', to: 'REJECTED', allowed: true },
    { from: 'PENDING', to: 'DRAFT', allowed: false },
    { from: 'APPROVED', to: 'REJECTED', allowed: false },
    { from: 'APPROVED', to: 'FORCE_CANCELLED', allowed: true },  // SUPER_ADMIN only
    { from: 'REJECTED', to: 'APPROVED', allowed: false },
    { from: 'FORCE_CANCELLED', to: 'APPROVED', allowed: false },
  ])('$from → $to is $allowed', async ({ from, to, allowed }) => {
    // setup + assert
  });
});
```

---

## 4. Integration Tests — Endpoint Level

استخدم real Postgres test database (مش mock).

```typescript
// payments.controller.spec.ts (integration)
describe('PaymentsController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let pmJwt: string;
  let workerJwt: string;
  let otherCompanyJwt: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = moduleRef.get(PrismaService);

    // Seed test data
    await seedTestData(prisma);
    pmJwt = await getTestJwt('pm@company-a.test');
    workerJwt = await getTestJwt('worker@company-a.test');
    otherCompanyJwt = await getTestJwt('pm@company-b.test');
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  describe('POST /payments', () => {
    const validPayload = { projectId: 'proj-a-1', amount: 5000, type: 'CLIENT_PAYMENT', method: 'BANK_TRANSFER', date: '2026-05-12' };

    it('201 when PM creates payment for own company project', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${pmJwt}`)
        .set('Idempotency-Key', randomUUID())
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe('5000');  // Decimal as string
    });

    it('403 when WORKER tries to create payment', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${workerJwt}`)
        .set('Idempotency-Key', randomUUID())
        .send(validPayload);

      expect(res.status).toBe(403);
    });

    it('404 when PM tries to create payment for another company project', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${otherCompanyJwt}`)
        .set('Idempotency-Key', randomUUID())
        .send(validPayload);

      expect(res.status).toBe(404);  // ⚠️ مش 403 — ما نكشفش الوجود
    });

    it('400 when amount is negative', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${pmJwt}`)
        .set('Idempotency-Key', randomUUID())
        .send({ ...validPayload, amount: -100 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('المبلغ');
    });

    it('400 when extra fields are sent (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${pmJwt}`)
        .set('Idempotency-Key', randomUUID())
        .send({ ...validPayload, secretField: 'hack' });

      expect(res.status).toBe(400);
    });

    it('401 without JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Idempotency-Key', randomUUID())
        .send(validPayload);

      expect(res.status).toBe(401);
    });

    it('idempotency: same key returns same payment without duplicate', async () => {
      const key = randomUUID();
      const res1 = await request(app.getHttpServer())
        .post('/payments').set('Authorization', `Bearer ${pmJwt}`)
        .set('Idempotency-Key', key).send(validPayload);
      const res2 = await request(app.getHttpServer())
        .post('/payments').set('Authorization', `Bearer ${pmJwt}`)
        .set('Idempotency-Key', key).send(validPayload);

      expect(res1.body.data.id).toBe(res2.body.data.id);
      const count = await prisma.payment.count({ where: { projectId: 'proj-a-1' } });
      expect(count).toBe(1);
    });

    it('creates audit log entry on success', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments').set('Authorization', `Bearer ${pmJwt}`)
        .set('Idempotency-Key', randomUUID()).send(validPayload);

      const audit = await prisma.auditLog.findFirst({
        where: { entityType: 'payment', entityId: res.body.data.id, action: 'CREATE' },
      });
      expect(audit).toBeTruthy();
      expect(audit.userId).toBe('pm-a-id');
      expect(audit.ipAddress).toBeTruthy();
    });
  });
});
```

---

## 5. Security Tests — كل feature

### Multi-tenant Isolation Tests (الأهم)
كل endpoint مهم: جرب بـ JWT من شركة تانية → لازم NotFound.

```typescript
describe('Multi-tenant isolation', () => {
  it.each([
    ['GET', '/projects/proj-a-1'],
    ['GET', '/payments/pay-a-1'],
    ['GET', '/updates/upd-a-1'],
    ['PATCH', '/projects/proj-a-1'],
    ['DELETE', '/payments/pay-a-1'],
  ])('returns 404 when cross-tenant access: %s %s', async (method, path) => {
    const res = await request(app.getHttpServer())
      [method.toLowerCase()](path)
      .set('Authorization', `Bearer ${otherCompanyJwt}`);

    expect(res.status).toBe(404);   // مش 403
  });
});
```

### Authorization Tests
لكل role × كل endpoint:
```typescript
const ROLE_MATRIX = [
  { role: 'SUPER_ADMIN', POST_payments: 201, DELETE_payments: 200 },
  { role: 'PROJECT_MANAGER', POST_payments: 201, DELETE_payments: 403 },
  { role: 'ACCOUNTANT', POST_payments: 201, DELETE_payments: 403 },
  { role: 'SITE_ENGINEER', POST_payments: 403, DELETE_payments: 403 },
  { role: 'WORKER', POST_payments: 403, DELETE_payments: 403 },
  { role: 'CLIENT', POST_payments: 403, DELETE_payments: 403 },
];

describe('Role matrix for /payments', () => {
  it.each(ROLE_MATRIX)('$role can/cannot perform operations', async ({ role, POST_payments, DELETE_payments }) => {
    const jwt = jwtsByRole[role];
    const post = await request(app.getHttpServer()).post('/payments').set('Authorization', `Bearer ${jwt}`).send(validPayload);
    expect(post.status).toBe(POST_payments);
    // ...
  });
});
```

### Injection Tests
```typescript
describe('Injection attempts', () => {
  it('SQL injection in search query is neutralized', async () => {
    const malicious = "'; DROP TABLE projects; --";
    const res = await request(app.getHttpServer())
      .get(`/projects?search=${encodeURIComponent(malicious)}`)
      .set('Authorization', `Bearer ${pmJwt}`);

    expect(res.status).toBe(200);  // مش 500
    // assert الجدول لسه موجود
    const count = await prisma.project.count();
    expect(count).toBeGreaterThan(0);
  });

  it('XSS in description is sanitized on write', async () => {
    const malicious = '<script>alert(1)</script>';
    const res = await request(app.getHttpServer())
      .post('/projects').set('Authorization', `Bearer ${pmJwt}`)
      .send({ name: 'Test', description: malicious, clientId: '...' });

    expect(res.body.data.description).not.toContain('<script>');
  });

  it('rejects oversized payloads (>1MB body)', async () => {
    const huge = 'x'.repeat(2 * 1024 * 1024);
    const res = await request(app.getHttpServer())
      .post('/projects').set('Authorization', `Bearer ${pmJwt}`)
      .send({ name: 'Test', description: huge });

    expect(res.status).toBe(413);
  });

  it('rejects path traversal in file uploads', async () => {
    const res = await request(app.getHttpServer())
      .post('/media/upload').set('Authorization', `Bearer ${pmJwt}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: '../../../etc/passwd.jpg' });

    // الـ storage path المفروض uuid مش الـ filename
    expect(res.body.data.url).not.toContain('..');
    expect(res.body.data.url).toMatch(/^[a-z0-9-/]+\.jpg$/);
  });
});
```

### Brute Force / Rate Limit Tests
```typescript
describe('Rate limiting', () => {
  it('blocks after 5 failed login attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });
    }
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@test.com', password: 'correct' });

    expect(res.status).toBe(429);  // Too Many Requests
  });
});
```

---

## 6. Tests لـ Critical Business Rules

كل واحدة من دول لازم عندها dedicated test:

### Updates
- [ ] لا يمكن submit update من غير submitter
- [ ] لا يمكن approve update مش PENDING
- [ ] approve يـ increment phase.progress بـ progressIncrement
- [ ] approve يـ cap الـ phase progress عند 100
- [ ] approve يـ recalculate project.overallProgress
- [ ] reject يطلب reason
- [ ] reject يحط الـ status REJECTED + reviewedBy + reviewedAt
- [ ] edit بعد approve خلال 24h يخلق UpdateVersion snapshot
- [ ] edit بعد approve > 24h يـ lock + يرفض
- [ ] force cancel SUPER_ADMIN فقط
- [ ] force cancel يعكس phase progress
- [ ] force cancel يخلق SUNK_COST لو في cost > 0
- [ ] force cancel + reject + delete-on-non-draft → audit log فيه reason
- [ ] CLIENT يشوف APPROVED فقط
- [ ] CLIENT ما يقدرش يعمل create / edit / approve
- [ ] Worker يشوف تحديثاته + APPROVED من غيره
- [ ] duplicate update لنفس user/phase/day → ConflictException

### Projects
- [ ] state machine: كل allowed + disallowed transition
- [ ] CLIENT يشوف مشاريعه فقط
- [ ] PROJECT_MANAGER يشوف كل مشاريع شركته
- [ ] ENGINEER يشوف المشاريع المعيّن عليها فقط
- [ ] assign member يـ require user من نفس الشركة
- [ ] remove member soft delete (removedAt) — مش hard delete
- [ ] recalculate progress يحسب weighted average

### Payments
- [ ] amount > 0 وأقل من max
- [ ] CLIENT يشوف مدفوعات مشاريعه فقط
- [ ] SUPER_ADMIN فقط يقدر يحذف
- [ ] soft delete بدلاً من delete
- [ ] decimal precision (2 places)
- [ ] idempotency key يمنع duplicates

### Auth
- [ ] register يخلق Company + User في transaction
- [ ] لو الـ DB transaction فشل → Supabase user rolled back
- [ ] login يـ reject expired subscription
- [ ] login يـ reject deactivated user
- [ ] login يـ reject deleted company
- [ ] account lock بعد 5 محاولات
- [ ] JWT بعد expired → 401

### Multi-tenant
- [ ] كل entity فيها companyId filter
- [ ] cross-tenant query بترجع empty / NotFound
- [ ] JWT بـ companyId مش موجود → 401

---

## 7. Test Data Factory

```typescript
// test/factories.ts
export const factories = {
  company: (overrides = {}) => ({
    id: randomUUID(), name: 'Test Co', slug: `test-${Date.now()}`,
    email: 'test@test.com', subscriptionStatus: 'ACTIVE',
    ...overrides,
  }),

  user: (overrides = {}) => ({
    id: randomUUID(), companyId: randomUUID(),
    supabaseAuthId: randomUUID(), email: 'user@test.com',
    name: 'Test User', role: 'WORKER', isActive: true,
    ...overrides,
  }),

  project: (overrides = {}) => ({
    id: randomUUID(), companyId: randomUUID(), clientId: randomUUID(),
    name: 'Test Project', status: 'IN_PROGRESS', totalBudget: 100000,
    ...overrides,
  }),
};
```

**استخدمها بدل ما تكتب objects كاملة في كل test.**

---

## 8. Test Isolation — مفيش tests بتعتمد على بعض

```typescript
beforeEach(async () => {
  await prisma.payment.deleteMany();
  await prisma.update.deleteMany();
  await prisma.project.deleteMany();
  // ... reset state
});
```

**أو** استخدم transactions:
```typescript
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});
afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

**القاعدة:** أي test يقدر يشتغل لوحده أو بترتيب مختلف وينجح.

---

## 9. ممنوع في الـ Tests

- ❌ `test.skip()` بدون issue link
- ❌ `expect(true).toBe(true)` (placeholder tests)
- ❌ Tests على implementation details بدلاً من behavior
- ❌ Snapshot tests للـ business logic (use explicit assertions)
- ❌ Real network calls (mock Supabase, ClamAV, email)
- ❌ `setTimeout` في tests (use `jest.useFakeTimers()`)
- ❌ Hard-coded UUIDs (use `randomUUID()` أو factory)
- ❌ Tests بتلوّث الـ shared state (DB / Redis / FS)
- ❌ Console.log في test files
- ❌ `any` type في mocks (use proper types)

---

## 10. Frontend Testing (futures)

لما الـ frontend يبدأ يتربط بالـ API:
- **Component tests**: React Testing Library (مش Enzyme)
- **Hook tests**: `@testing-library/react-hooks`
- **E2E**: Playwright (better than Cypress for Arabic / RTL)
- **Visual regression**: Chromatic / Percy

Targets:
- Forms: validation + submit + error
- RBAC: role-based hiding/showing
- i18n: AR + EN rendering
- RTL: layout flips correctly
- Critical flows: login → dashboard → create project → submit update

---

## CI/CD Test Gate

في الـ CI pipeline:
```yaml
- run: pnpm install
- run: pnpm prisma migrate deploy  # على test DB
- run: pnpm test --coverage --runInBand
- run: pnpm test:e2e
- name: Coverage gate
  run: |
    if [ $(jq '.total.lines.pct' coverage/coverage-summary.json) -lt 75 ]; then
      echo "Coverage below 75%"
      exit 1
    fi
```

**PR لازم يفشل لو:**
- Tests failed
- Coverage نزل
- Linter errors
- Type errors

---

## Checklist لأي PR

- [ ] كل business rule جديدة عندها unit test
- [ ] كل endpoint جديد عنده integration test
- [ ] multi-tenant test (cross-company → 404)
- [ ] authorization matrix (كل role × endpoint)
- [ ] injection test (SQL / XSS) لو في user input
- [ ] state machine test (لو في state transitions)
- [ ] audit log test (audit entry created)
- [ ] idempotency test (لو financial endpoint)
- [ ] error scenarios (4xx + 5xx)
- [ ] tests isolated (يشتغلوا بأي ترتيب)
- [ ] coverage مش نازل عن الـ threshold
- [ ] الـ CI أخضر

---

## Bottom Line

كل feature بدون tests = **حماية فقط لو الحياة سهلة**. لما يجي bug في production:
- مع tests: تـ reproduce بـ test، تصلح، تتأكد ما يرجعش
- بدون tests: تـ guess + manual testing + خطر regression

**الـ tests = الـ insurance policy لكل خط كود.**
