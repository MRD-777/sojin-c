---
name: database
description: Use when writing Prisma queries, designing schema changes, or working with the PostgreSQL database. Enforces parameterized queries, transactions, soft deletes, auditing, indexing, and multi-tenant isolation.
---

# Database — Safety Rules

> ⚠️ هذه قاعدة بيانات تحتوي على عقود ومدفوعات بقيمة ملايين. أي query غلط = خسارة مالية أو تسريب بيانات.
> القاعدة: **افترض أن كل query هينفذ بـ JWT من attacker، حتى تثبت العكس بـ multi-tenant filter**.

---

## القواعد الأساسية

### 1. Parameterized queries فقط — string concatenation ممنوع نهائياً

Prisma client بيستخدم prepared statements تلقائياً. **لكن** `$queryRawUnsafe` و `$executeRawUnsafe` ممنوعَين تماماً.

✅ صح:
```typescript
// Prisma client — parameterized تلقائياً
const projects = await this.prisma.project.findMany({
  where: {
    companyId: user.companyId,
    name: { contains: query.search, mode: 'insensitive' },
  },
});

// Raw query لو محتاج — استخدم Prisma.sql tag
const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
  SELECT COUNT(*) as count
  FROM updates
  WHERE company_id = ${user.companyId}::uuid
    AND created_at >= ${startDate}
`;
```

❌ غلط — كارثة أمنية:
```typescript
// ⛔ ممنوع تماماً
await this.prisma.$queryRawUnsafe(
  `SELECT * FROM projects WHERE name = '${query.search}'`
);
// لو search = "'; DROP TABLE projects; --" → الجدول راح
```

**القاعدة:** لو لقيت `$queryRawUnsafe` في الـ codebase، اعتبره bug critical وأبلغ عنه فوراً.

### 2. كل write operation فيها transaction — حتى لو خطوة واحدة "حالياً"

أي عملية بتعدل أكتر من سجل، أو بتعدل سجل + بتكتب audit log، **لازم تكون في `$transaction`**.

✅ صح — pattern من `updates.service.ts`:
```typescript
async approve(user: JwtPayload, updateId: string, req: Request) {
  const update = await this.prisma.update.findFirst({ /* ... */ });

  if (!update) throw new NotFoundException('التحديث غير موجود');
  if (update.status !== 'PENDING') throw new BadRequestException('...');

  // كل التعديلات في transaction واحدة
  const [approved] = await this.prisma.$transaction([
    this.prisma.update.update({
      where: { id: updateId },
      data: { status: 'APPROVED', reviewedBy: user.userId, reviewedAt: new Date() },
    }),
    this.prisma.phase.update({
      where: { id: update.phaseId },
      data: { progress: { increment: update.progressIncrement } },
    }),
  ]);

  await this.projectsService.recalculateProgress(update.phase.projectId);
  await this.auditLog.log({ /* ... */ });

  return approved;
}
```

❌ غلط — race condition وحالة inconsistent:
```typescript
async approve(updateId: string) {
  await this.prisma.update.update({ where: { id: updateId }, data: { status: 'APPROVED' } });
  // ⛔ لو الـ server crash هنا، update معتمد بدون progress increment
  await this.prisma.phase.update({ where: { id: phaseId }, data: { progress: { increment: 10 } } });
}
```

**القاعدة:** لو الـ method فيه أكتر من Prisma write call، استخدم `$transaction` (interactive للـ logic المعقدة، array للـ batch operations).

### 3. Interactive transactions للـ business logic المعقدة

✅ صح:
```typescript
async transferProject(user: JwtPayload, projectId: string, newManagerId: string, req: Request) {
  return this.prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, companyId: user.companyId, ...this.prisma.softDeleteFilter },
    });
    if (!project) throw new NotFoundException('المشروع غير موجود');

    const newManager = await tx.user.findFirst({
      where: { id: newManagerId, companyId: user.companyId, role: 'PROJECT_MANAGER' },
    });
    if (!newManager) throw new BadRequestException('المدير الجديد غير صالح');

    // remove old PM assignment
    await tx.projectAssignment.updateMany({
      where: { projectId, roleInProject: 'PROJECT_MANAGER' as any, removedAt: null },
      data: { removedAt: new Date() },
    });

    // add new PM
    await tx.projectAssignment.create({
      data: { projectId, userId: newManagerId, roleInProject: 'PROJECT_MANAGER' as any },
    });

    // audit log
    await tx.auditLog.create({
      data: { /* ... */ },
    });

    return { success: true };
  }, {
    maxWait: 5000,      // wait max 5s to acquire connection
    timeout: 10000,     // transaction max 10s
    isolationLevel: 'Serializable',  // للمالية = أعلى مستوى
  });
}
```

**Isolation levels:**
- `ReadCommitted` (default) — صالح لمعظم الحالات
- `RepeatableRead` — للـ reports اللي بتقرأ عدة جداول
- `Serializable` — للمالية والـ critical state changes (approve, reject, force cancel)

### 4. Optimistic Locking للعمليات المتزامنة

لما اتنين users يفتحوا نفس الـ project ويعدلوا في نفس الوقت — اللي يـ save بعدين يكتب فوق التاني (lost update). الحل: optimistic locking باستخدام `updatedAt` أو version field.

**الإضافة المطلوبة على schema** للـ entities المعرّضة للـ concurrent writes (Project, Phase, Update, Payment):
```prisma
model Project {
  // ... existing fields
  version Int @default(0)  // optimistic lock counter
  // ...
}
```

✅ صح:
```typescript
async update(user: JwtPayload, projectId: string, dto: UpdateProjectDto, expectedVersion: number) {
  const existing = await this.getOwnedProject(user.companyId, projectId);

  if (existing.version !== expectedVersion) {
    throw new ConflictException(
      'تم تعديل المشروع من قبل مستخدم آخر. أعد تحميل الصفحة وحاول مجدداً.',
    );
  }

  return this.prisma.project.update({
    where: { id: projectId, version: expectedVersion },  // لو الـ version اتغير، الـ update هيـ fail
    data: { ...dto, version: { increment: 1 } },
  });
}
```

**في الفرونت:** لازم ترسل الـ `version` اللي جابتها أول مرة في كل update request.

### 5. Soft Delete فقط — حذف حقيقي ممنوع

كل entity مالية أو قانونية لها `deletedAt: DateTime?`. **مفيش `prisma.X.delete()` في أي مكان**.

✅ صح:
```typescript
async softDelete(user: JwtPayload, paymentId: string, req: Request) {
  const payment = await this.prisma.payment.findFirst({
    where: { id: paymentId, project: { companyId: user.companyId }, deletedAt: null },
  });
  if (!payment) throw new NotFoundException('الدفعة غير موجودة');

  await this.prisma.payment.update({
    where: { id: paymentId },
    data: { deletedAt: new Date() },
  });

  await this.auditLog.log({
    companyId: user.companyId, userId: user.userId, userRole: user.role,
    entityType: 'payment', entityId: paymentId, action: AuditAction.DELETE,
    oldValues: { amount: payment.amount, type: payment.type }, req,
  });

  return { message: 'تم حذف الدفعة' };
}
```

❌ غلط — كارثة قانونية:
```typescript
await this.prisma.payment.delete({ where: { id: paymentId } });  // ⛔ مفيش رجوع
```

**استخدم دايماً `prisma.softDeleteFilter` في الـ where:**
```typescript
where: { id, companyId: user.companyId, ...this.prisma.softDeleteFilter }
```

### 6. Multi-tenant filter في كل query — بدون استثناء

**كل query لازم تفلتر بـ `companyId`.** هذه أهم قاعدة في المشروع.

✅ صح:
```typescript
where: {
  id: projectId,
  companyId: user.companyId,  // 🔒 إجباري
  ...this.prisma.softDeleteFilter,
}
```

✅ صح — للـ nested entities (Phase, Update, Comment):
```typescript
where: {
  id: updateId,
  phase: { project: { companyId: user.companyId } },  // 🔒 عبر relation
  ...this.prisma.softDeleteFilter,
}
```

❌ غلط — multi-tenant leak:
```typescript
where: { id: updateId }  // ⛔ أي مستخدم يقدر يشوف updates من أي شركة
```

**القاعدة:** لو الـ where ما فيهاش `companyId` أو filter عبر relation للـ company، اعتبره bug خطير.

### 7. SELECT محدد الأعمدة — `select *` ممنوع

`prisma.X.findMany()` بدون `select` بيرجع كل الأعمدة بما فيها الـ sensitive.

✅ صح — pattern من `projects.service.ts`:
```typescript
const PROJECT_SELECT = {
  id: true, name: true, status: true, totalBudget: true,
  client: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ProjectSelect;

return this.prisma.project.findMany({ where, select: PROJECT_SELECT });
```

❌ غلط:
```typescript
return this.prisma.user.findMany({ where: { companyId } });
// ⛔ بترجع supabaseAuthId, customPermissions, notificationPreferences للـ client
```

**حدد الأعمدة الحساسة كـ "select-explicit-only":**
- `User.supabaseAuthId` — ما يطلعش للـ frontend
- `User.customPermissions` — internal use only
- `Company.settings` — internal use
- أي field فيه token أو secret

### 8. Audit Log إجباري لكل INSERT/UPDATE/DELETE

كل write operation على entity أساسية (Project, Update, Payment, User, Phase) **لازم** يستدعي `auditLog.log({ ... })`.

✅ صح:
```typescript
await this.auditLog.log({
  companyId: user.companyId,
  userId: user.userId,
  userRole: user.role,
  entityType: 'payment',
  entityId: payment.id,
  action: AuditAction.CREATE,
  oldValues: null,
  newValues: { amount: payment.amount, type: payment.type, projectId: dto.projectId },
  req,  // بياخد IP + User-Agent
});
```

**الفرق بين oldValues و newValues:**
- CREATE: `oldValues: null`, `newValues: { ... }`
- UPDATE: `oldValues: { fieldA: oldVal }`, `newValues: { fieldA: newVal }` — **فقط الـ fields اللي اتغيرت**
- DELETE: `oldValues: { ... }`, `newValues: null`

شوف **`07-audit-compliance.md`** للتفاصيل الكاملة.

### 9. Indexes على كل foreign key + كل filterable column

الـ schema الحالي فيه indexes معظم الجداول. **عند إضافة column جديد للـ filtering** (status, type, date range):

✅ صح في `schema.prisma`:
```prisma
model Payment {
  // ...
  status PaymentStatus @default(PENDING)
  date   DateTime      @db.Date

  @@index([projectId])
  @@index([projectId, status])      // composite للـ common queries
  @@index([projectId, date])        // للـ date range filtering
  @@index([companyId, date])        // للـ company-wide reports
}
```

**Rule of thumb:** لو في `WHERE x = ?` أو `ORDER BY x` على column معين أكتر من مرة، حطله index.

⚠️ **لكن:** index على كل عمود = إبطاء الـ writes. وزّن.

### 10. Audited Fields على كل جدول

الـ schema الحالي فيه `createdAt` و `updatedAt` لكن **ناقص `createdBy` و `updatedBy`**. عند إنشاء models جديدة أو تعديل الموجودة:

```prisma
model Payment {
  // ... existing
  createdBy String   @map("created_by") @db.Uuid
  updatedBy String?  @map("updated_by") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")
  deletedBy String?  @map("deleted_by") @db.Uuid

  creator User  @relation("PaymentCreator", fields: [createdBy], references: [id])
  updater User? @relation("PaymentUpdater", fields: [updatedBy], references: [id])
}
```

**الـ entities اللي عندها `recordedBy` بالفعل**: `Payment`. باقي الـ entities محتاجة إضافة `createdBy/updatedBy`.

### 11. Decimal للمالية — Float ممنوع

كل value مالي في الـ schema **لازم** يكون `Decimal` مع precision محدد.

✅ صح:
```prisma
amount   Decimal @db.Decimal(15, 2)   // 13 رقم + 2 عشري
budget   Decimal @db.Decimal(15, 2)
cost     Decimal @db.Decimal(15, 2)
workHours Decimal @db.Decimal(5, 2)   // hours صغيرة
```

❌ غلط — fatal للمالية:
```prisma
amount Float  // ⛔ floating point errors: 0.1 + 0.2 = 0.30000000000000004
```

**في الـ TypeScript:** Prisma بيرجع `Decimal` (من `@prisma/client/runtime/library`). **لا تحوّلها لـ `Number` إلا لو لازم**. لو محتاج تحوّل: `Number(payment.amount)` — وفقط للـ JSON response.

للحسابات: استخدم `Decimal.add()`, `Decimal.mul()`:
```typescript
import { Decimal } from '@prisma/client/runtime/library';

const total = payments.reduce(
  (sum, p) => sum.add(p.amount),
  new Decimal(0),
);
```

### 12. Backup Strategy

**على Supabase production:**
- Point-in-Time Recovery (PITR): مفعّل (يحتاج Pro plan على الأقل)
- Daily automated backups
- Manual backup قبل أي migration كبيرة
- Test restore على staging مرة كل شهر

**قبل أي migration:**
```bash
# Snapshot قبل الـ migration
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# لا تشغل migration على production بدون snapshot
```

**Migrations:**
- **لا تستخدم `prisma db push` على production أبداً** — بس للـ dev
- استخدم `prisma migrate deploy` على production
- كل migration لازم يكون فيه rollback plan موثّق

---

## Anti-patterns (لو شفتهم اعتبرهم bugs)

```typescript
// ⛔ 1. Find without companyId filter
prisma.project.findUnique({ where: { id } });

// ⛔ 2. Find without softDeleteFilter (للـ entities الـ soft-deletable)
prisma.payment.findMany({ where: { projectId } });

// ⛔ 3. Update without checking ownership first
prisma.user.update({ where: { id }, data: { role: 'SUPER_ADMIN' } });

// ⛔ 4. Hard delete
prisma.payment.delete({ where: { id } });

// ⛔ 5. Raw SQL with string concat
prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`);

// ⛔ 6. SELECT * (no select clause)
prisma.user.findMany();  // بيرجع supabaseAuthId, customPermissions

// ⛔ 7. Multiple writes outside transaction
await prisma.update.update({ ... });
await prisma.phase.update({ ... });  // race condition

// ⛔ 8. Float للمالية
amount: Float

// ⛔ 9. No audit log on mutation
await prisma.payment.update({ ... });
// مفيش auditLog.log() بعدها

// ⛔ 10. findMany بدون pagination
prisma.audit_log.findMany({ where: { companyId } });  // ممكن يرجع ملايين السجلات
```

---

## Checklist قبل أي PR فيه schema/query changes

- [ ] الـ query فيها `companyId` filter (مباشر أو عبر relation)
- [ ] الـ query فيها `softDeleteFilter` للـ entities المعرّضة
- [ ] فيها `select` محدد (مش بيرجع كل الـ columns)
- [ ] لو write: في `$transaction` مع audit log
- [ ] لو financial: `Decimal` + `Serializable` isolation
- [ ] لو فيه concurrent update risk: `version` field + check
- [ ] لو list: pagination + max limit
- [ ] لو schema change: index على الـ FK والـ filter columns
- [ ] لو schema change: migration file مع rollback plan
- [ ] جربت الـ query بـ companyId من شركة تانية → returned empty/NotFound
