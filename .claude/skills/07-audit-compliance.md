---
name: audit-compliance
description: Use when implementing audit logging, financial operations, immutable records, data retention, export functionality, or anything that may be needed as legal evidence. Enforces immutable audit trail, double-entry for financial actions, UTC timestamps, retention policies, and export-ready audit logs.
---

# Audit & Compliance — Safety Rules

> ⚠️ هذا أهم skill في المشروع. عقود البناء = ملايين الجنيهات. لو حصل نزاع قانوني والـ audit ناقص → الشركة تخسر القضية بغض النظر عمن على صواب.
> القاعدة الذهبية: **"If it didn't get audited, it didn't happen"** — أي action مهم بدون audit log = action مش موجود في عيون القانون.

---

## 1. ما اللي بيتسجل (Audit Coverage)

### إجباري — Mutation Audit
كل INSERT / UPDATE / DELETE على الـ entities التالية:

| Entity | كل action |
|---|---|
| `Company` | كل update + كل subscription change |
| `User` | create, update (role, isActive, permissions), soft delete |
| `Project` | create, update, status change, soft delete |
| `ProjectAssignment` | create, remove |
| `Phase` | create, update, status change, soft delete |
| `Update` | كل state transition + edit-after-approval + force cancel |
| `UpdateVersion` | create (تلقائي مع edit-after-approval) |
| `Payment` | create, update, soft delete |
| `SubContractor` | create, update, terminate |
| `PhaseSubContractor` | create, update cost, status change |
| `Media` | upload, delete |
| `Comment` (REVIEW/CHANGE_REQUEST فقط) | create |

### إجباري — Access Audit (للـ sensitive reads)
- View / Download Contract
- View / Download Payment Receipt
- View / Export Audit Trail
- View Financial Reports
- Export Data (CSV / PDF)

### إجباري — Auth Audit
- Login (success / fail)
- Logout
- Password change
- Email change
- Role change (by admin)
- Permission grant / revoke
- Account lock / unlock
- Token refresh من IP جديد
- Failed authorization attempts (تكرر = suspicious)

### غير إجباري لكن مفيد
- Search queries على audit log نفسه (meta-auditing)
- Settings changes
- Notification preferences changes

---

## 2. Audit Log Structure (الموجود في الـ schema)

```prisma
model AuditLog {
  id         String      @id @default(uuid()) @db.Uuid
  companyId  String      @map("company_id") @db.Uuid
  userId     String      @map("user_id") @db.Uuid       // 🆔 المُنفّذ
  userRole   String      @map("user_role")              // 📝 لو الـ role اتغير بعدين، عندنا snapshot
  entityType String      @map("entity_type")            // "payment", "update", "project"
  entityId   String      @map("entity_id") @db.Uuid
  action     AuditAction                                 // CREATE | UPDATE | DELETE | APPROVE | REJECT | FORCE_CANCEL | PROGRESS_OVERRIDE
  oldValues  Json?       @map("old_values")             // قبل التغيير
  newValues  Json?       @map("new_values")             // بعد التغيير
  reason     String?     @db.Text                        // مطلوب للـ negative actions
  ipAddress  String?     @map("ip_address")
  userAgent  String?     @map("user_agent")
  createdAt  DateTime    @default(now()) @map("created_at")  // UTC always
}
```

### الـ Fields المطلوبة من الـ Skill Description

| اللي طلبته | في الـ schema |
|---|---|
| مين | `userId` + `userRole` |
| من أي IP | `ipAddress` |
| امتى | `createdAt` (UTC) |
| إيه اللي اتعمل | `entityType` + `action` |
| قبل | `oldValues` |
| بعد | `newValues` |

✅ كل المطلوب موجود. **ممنوع تخفي أي field من دول.**

### إضافات مقترحة على الـ schema
```prisma
model AuditLog {
  // ... الموجود
  sessionId       String?  @map("session_id")        // لو متحط الـ session ID
  requestId       String?  @map("request_id")        // لـ correlation عبر الـ logs
  durationMs      Int?     @map("duration_ms")       // كم استغرقت العملية
  hashChain       String   @map("hash_chain") @db.Char(64)  // SHA-256 = prev hash → tamper detection
}
```

**Hash chain** (اختياري متقدم): كل سجل بيخزن hash للسجل اللي قبله → لو حد عدل سجل في النص، الـ chain يتكسر وبنكتشف.

---

## 3. AuditLogService — Helper

```typescript
// modules/audit/audit-log.service.ts
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log outside transaction (default).
   * Use for actions where the main DB write already committed
   * and audit failure shouldn't roll it back (rare — prefer logInTransaction).
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: this.buildData(input) });
    } catch (error) {
      // ⚠️ كارثة — audit مش بيتسجل
      this.alerting.criticalAlert('Audit log write failed', { input, error });
      throw new SystemException({
        code: 'AUDIT_SYS_001' as any,
        userMessage: 'حدث خطأ في تسجيل العملية',
        devMessage: 'Audit log creation failed — investigate immediately',
        cause: error,
      });
    }
  }

  /**
   * Log inside transaction.
   * USE THIS for any financial / state-change action.
   * If audit fails, the main operation rolls back.
   */
  async logInTransaction(
    tx: Prisma.TransactionClient,
    input: AuditLogInput,
  ): Promise<void> {
    await tx.auditLog.create({ data: this.buildData(input) });
  }

  private buildData(input: AuditLogInput): Prisma.AuditLogCreateInput {
    return {
      companyId: input.companyId,
      userId: input.userId,
      userRole: input.userRole,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      oldValues: input.oldValues ?? undefined,
      newValues: input.newValues ?? undefined,
      reason: input.reason,
      ipAddress: input.req?.ip ?? null,
      userAgent: input.req?.headers['user-agent'] ?? null,
    };
  }
}
```

---

## 4. Immutability — audit_logs ما تتعدلش أبداً

الجدول `audit_logs` هو **append-only**. حتى SUPER_ADMIN ما يقدر يعدل / يمسح سجل.

### Database-level enforcement
على PostgreSQL، ضيف policy / trigger:

```sql
-- منع UPDATE و DELETE على audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_modification()
  RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only — % operation forbidden', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_audit_logs
  BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION prevent_audit_modification();
```

أو عبر Supabase RLS:
```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_insert_only" ON audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "audit_read_company" ON audit_logs
  FOR SELECT USING (company_id = current_setting('app.current_company_id')::uuid);

-- لا policies لـ UPDATE / DELETE → ممنوعة
```

### Application-level
- لا method `update` أو `delete` في `AuditLogService`
- لا `prisma.auditLog.update()` أو `prisma.auditLog.delete()` في أي مكان في الـ codebase
- لو لقيتهم → اعتبره **critical security bug**

---

## 5. Financial Actions — Double-Entry Audit

أي action مالي (Payment create, Update approval بـ cost, Force cancel, Phase budget change) لازم:

1. الـ entry الأصلي في الـ entity (payments, updates...)
2. الـ audit_log entry
3. (اختياري) ledger entry في جدول منفصل للـ accounting

### الـ Pattern
```typescript
async createPayment(user: JwtPayload, dto: CreatePaymentDto, req: Request) {
  return this.prisma.$transaction(async (tx) => {
    // 1. الـ payment الأساسي
    const payment = await tx.payment.create({
      data: {
        projectId: dto.projectId,
        amount: dto.amount,
        type: dto.type,
        method: dto.method,
        date: new Date(dto.date),
        description: dto.description,
        recordedBy: user.userId,
      },
    });

    // 2. Audit log داخل الـ transaction
    await this.auditLog.logInTransaction(tx, {
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'payment',
      entityId: payment.id,
      action: AuditAction.CREATE,
      oldValues: null,
      newValues: {
        amount: payment.amount.toString(),     // Decimal → string عشان JSON
        type: payment.type,
        method: payment.method,
        projectId: payment.projectId,
        date: payment.date.toISOString(),
      },
      req,
    });

    // 3. Project balance update (optional ledger pattern)
    // await tx.projectBalance.update({ where: { projectId: dto.projectId }, ... });

    return payment;
  }, { isolationLevel: 'Serializable' });
}
```

**القواعد:**
- الـ audit جوّا الـ `$transaction` — لو فشل، الـ payment يـ rollback
- `Serializable` isolation للحماية من race conditions
- الـ amount يتخزن كـ string في الـ JSON (الـ Decimal بيفقد precision لو اتحول لـ Number)
- مفيش `oldValues: null` على create — اكتب `null` صراحة

### Reversal Actions
لو payment / update اتعكس (force cancel)، لازم:
- الـ payment الأصلي ما يتمسحش — يفضل (audit trail)
- entry جديد بـ type `REVERSAL` أو `SUNK_COST`
- audit log منفصل لكل entry

```typescript
async forceCancel(user, updateId, dto, req) {
  return this.prisma.$transaction(async (tx) => {
    const update = await tx.update.findFirstOrThrow({ /* ... */ });

    // 1. Mark update as cancelled
    await tx.update.update({
      where: { id: updateId },
      data: { status: 'FORCE_CANCELLED', forceCancelReason: dto.reason, forceCancelledBy: user.userId },
    });

    // 2. Reverse phase progress
    await tx.phase.update({ where: { id: update.phaseId }, data: { progress: { decrement: update.progressIncrement } } });

    // 3. لو في cost → SUNK_COST payment (مش حذف، إضافة)
    if (Number(update.cost) > 0) {
      const sunkCost = await tx.payment.create({
        data: {
          projectId: update.phase.projectId,
          amount: update.cost,
          type: 'SUNK_COST',
          method: 'OTHER',
          description: `تكلفة غارقة من إلغاء تحديث: ${update.title}`,
          date: new Date(),
          recordedBy: user.userId,
        },
      });

      // ✅ audit للـ SUNK_COST entry
      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId, userId: user.userId, userRole: user.role,
        entityType: 'payment', entityId: sunkCost.id, action: AuditAction.CREATE,
        newValues: { amount: sunkCost.amount.toString(), type: 'SUNK_COST', reversedUpdateId: updateId },
        reason: dto.reason, req,
      });
    }

    // ✅ audit للـ FORCE_CANCEL action نفسها
    await this.auditLog.logInTransaction(tx, {
      companyId: user.companyId, userId: user.userId, userRole: user.role,
      entityType: 'update', entityId: updateId, action: AuditAction.FORCE_CANCEL,
      oldValues: { status: 'APPROVED', cost: update.cost.toString() },
      newValues: { status: 'FORCE_CANCELLED' },
      reason: dto.reason, req,
    });
  }, { isolationLevel: 'Serializable' });
}
```

---

## 6. UTC Timestamps دايماً

**كل** `createdAt`, `updatedAt`, `deletedAt`, `reviewedAt`, `submittedAt`, `lockedAt`:
- في الـ DB: `TIMESTAMP WITH TIME ZONE` (الـ default في Postgres لـ `DateTime` في Prisma)
- في الـ application: `new Date()` (الـ JS Date object بـ UTC داخلياً)
- في الـ API response: ISO 8601 string بـ UTC: `"2026-05-12T14:30:00.000Z"`

**العرض في الـ UI**:
- conversion للـ timezone بتاع المستخدم في الـ frontend بس
- استخدم `Intl.DateTimeFormat` أو `date-fns-tz` أو `Temporal` (لما يبقى stable)
- استخدم `Company.timezone` (موجود في الـ schema، default `Africa/Cairo`)

❌ ممنوع تماماً:
```typescript
// ⛔ التخزين بـ local time
const localDate = new Date().toLocaleString('ar-EG');
await prisma.update.create({ data: { submittedAt: localDate } });

// ⛔ مقارنات بـ string time
if (update.createdAt > '2026-01-01') { /* ... */ }

// ⛔ Date math بـ string
const tomorrow = new Date(today.toISOString().slice(0, 10) + 'T...');   // عرضة لـ DST bugs
```

✅ صح:
```typescript
import { addDays, startOfDay } from 'date-fns';

const todayUTC = startOfDay(new Date());
const tomorrowUTC = addDays(todayUTC, 1);

const updates = await prisma.update.findMany({
  where: { createdAt: { gte: todayUTC, lt: tomorrowUTC } },
});
```

---

## 7. Data Retention Policy

| Data type | Retention | السبب |
|---|---|---|
| `audit_logs` | **7 سنوات** | القانون التجاري المصري (المادة 24) |
| `payments` (soft-deleted) | **10 سنوات** | الضرائب + audit trail |
| `updates` + `update_versions` | **7 سنوات** | حق العميل في الطعن |
| `media` (للـ updates) | **7 سنوات** | proof للأعمال |
| `chat_messages` (soft-deleted) | **سنة واحدة** | بعدها archive then delete |
| `notifications` (read) | **3 شهور** | غير قانوني، نظافة DB |
| `daily_update_trackers` | **3 سنوات** | reports + analytics |
| `users` (soft-deleted) | **7 سنوات** | accountability — لو في dispute |
| Failed login attempts | **سنة** | security forensics |

### Implementation
**لا** hard-delete من الـ application code. كل الـ deletes soft. الـ archival / hard-delete = cron job منفصل بـ SUPER_ADMIN approval.

```typescript
// scripts/retention-cleanup.ts (cron job — يدوي على staging أولاً)
async function archiveOldData() {
  const cutoff = subYears(new Date(), 7);

  // Archive to cold storage (S3 Glacier / Supabase Storage archive bucket)
  const oldAudits = await prisma.auditLog.findMany({
    where: { createdAt: { lt: cutoff } },
    take: 10_000,
  });
  await uploadToArchive(oldAudits, `audit-archive-${format(cutoff, 'yyyy-MM-dd')}.json.gz`);

  // ⚠️ احذف بس بعد ما تتأكد من الـ archive
  // await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
```

**Backup قبل أي retention deletion** — إجباري.

---

## 8. Export Audit Trail

أي SUPER_ADMIN لازم يقدر يـ export الـ audit trail لأي entity:

```typescript
@Get('audit/export')
@Roles('SUPER_ADMIN')
async exportAuditTrail(
  @CurrentUser() user: JwtPayload,
  @Query() query: ExportAuditQueryDto,
  @Res() res: Response,
) {
  // Throttle — export ثقيل
  // التحقق من الـ params (date range max 1 year, entity filter optional)

  const audits = await this.auditService.export({
    companyId: user.companyId,
    entityType: query.entityType,
    entityId: query.entityId,
    fromDate: query.fromDate,
    toDate: query.toDate,
  });

  // CSV
  const csv = await this.csvExporter.export(audits, {
    columns: ['createdAt', 'userId', 'userRole', 'action', 'entityType', 'entityId', 'oldValues', 'newValues', 'reason', 'ipAddress'],
  });

  // Audit the export itself (meta!)
  await this.auditLog.log({
    companyId: user.companyId, userId: user.userId, userRole: user.role,
    entityType: 'audit_export', entityId: user.userId, action: AuditAction.CREATE,
    newValues: { rowCount: audits.length, filter: query },
    req,
  });

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="audit-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
  });
  res.send(csv);
}
```

**الـ export format options**: CSV (للـ Excel)، JSON (للـ technical)، PDF (للـ legal).

**كل export يتم audit-ه**.

---

## 9. Reason Field — مطلوب للـ Negative Actions

```typescript
// أي action negative لازم reason
const NEGATIVE_ACTIONS_REQUIRING_REASON = [
  'REJECT',           // update rejection
  'FORCE_CANCEL',     // update force cancellation
  'DELETE',           // soft delete (Project, Payment, User)
  'STATUS_CHANGE_TO_ON_HOLD',
  'STATUS_CHANGE_TO_CANCELLED',
  'PROGRESS_OVERRIDE',
  'PERMISSION_REVOKE',
  'ROLE_DOWNGRADE',
];

// في الـ DTO:
@IsString()
@MinLength(20, { message: 'سبب الإلغاء يجب أن يكون 20 حرف على الأقل' })
@MaxLength(2000)
reason: string;

// في الـ service:
if (!dto.reason || dto.reason.trim().length < 20) {
  throw new BadRequestException('السبب مطلوب لهذه العملية');
}
```

**Reason يبقى في:**
- الـ entity field (مثل `Update.forceCancelReason`)
- الـ audit_log entry

---

## 10. PII Handling في الـ Audit Logs

الـ audit logs بتحتوي على بيانات حساسة. لازم:

- **لا تـ log password / token / secret** حتى في `oldValues` / `newValues`:
```typescript
// ⛔ كارثة
await auditLog.log({ oldValues: { password: oldHash } });

// ✅ صح
await auditLog.log({ oldValues: { passwordChanged: true } });
```

- **Mask emails في الـ logs لو الـ feature بيتعرض على non-admins**:
```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}
```

- **لـ GDPR-like requests**: لو user طلب delete، الـ audit logs بـ keep (compliance) لكن PII فيها تتعمل anonymization:
  - `userId` يفضل (لازم للـ correlation)
  - `email`, `name` يتحولوا لـ `[deleted-user]`
  - `oldValues` يفضلوا كما هم (proof)

---

## 11. Audit-Backed Queries

أي query للـ "مين عمل إيه":
```typescript
async getEntityHistory(user: JwtPayload, entityType: string, entityId: string) {
  // Ownership check first
  await this.verifyAccess(user, entityType, entityId);

  return this.prisma.auditLog.findMany({
    where: { entityType, entityId, companyId: user.companyId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      action: true,
      oldValues: true,
      newValues: true,
      reason: true,
      createdAt: true,
      ipAddress: true,
      user: { select: { id: true, name: true, role: true } },
    },
  });
}
```

**الـ audit history endpoint** متاح لكل entity. الـ frontend بيعرضه في "Activity log" tab.

---

## 12. The Three Questions

قبل أي feature بيغير state:

**1. لو في dispute قانوني، نقدر نثبت إيه اللي حصل؟**
- لو لا → ضيف audit log
- لو نعم → كمل

**2. لو attacker عدّل الـ audit logs، هنكتشف؟**
- DB triggers بيمنعوا UPDATE / DELETE
- Hash chain (optional advanced)
- Off-site backup يومي
- Periodic integrity check

**3. لو راح للمحكمة، الـ audit trail يكفي؟**
- مين (user + role + IP)
- امتى (UTC timestamp)
- إيه (action + oldValues + newValues)
- ليه (reason للـ negative)
- Evidence (linked media / documents)

---

## Anti-patterns

```typescript
// ⛔ 1. action بدون audit
await prisma.payment.create({ data: { ... } });
// مفيش auditLog.log()

// ⛔ 2. Audit خارج الـ transaction (لـ financial)
await prisma.$transaction([...]);
await auditLog.log({...});   // لو فشل، عملية مالية بدون audit

// ⛔ 3. Audit بـ try/catch بيـ swallow
try { await auditLog.log(...); } catch {}   // silent

// ⛔ 4. ما نـ log الـ IP / User-Agent
await auditLog.log({ ..., req: undefined });

// ⛔ 5. تعديل audit log
await prisma.auditLog.update({ where: { id }, data: { reason: 'corrected' } });

// ⛔ 6. حذف audit log
await prisma.auditLog.delete({ where: { id } });

// ⛔ 7. Audit بـ local time
createdAt: new Date().toLocaleString()

// ⛔ 8. Storing password / token في newValues
newValues: { password: 'newPassword123', token: 'eyJ...' }

// ⛔ 9. Force cancel بدون reason
forceCancel(updateId)   // reason undefined

// ⛔ 10. Hard delete على entity مالية
prisma.payment.delete({ where: { id } });
```

---

## Checklist لأي PR بيغير state

- [ ] Audit log entry لكل CREATE / UPDATE / DELETE
- [ ] الـ audit جوّا الـ `$transaction` للـ financial / state-change
- [ ] `userId` + `userRole` (snapshot) + `ipAddress` + `userAgent`
- [ ] `oldValues` بيحتوي على الـ fields اللي اتغيرت فقط
- [ ] `newValues` متطابق مع الـ entity بعد التعديل
- [ ] `reason` مطلوب لـ negative actions (reject, force, delete, status downgrade)
- [ ] لا secrets / passwords / tokens في الـ oldValues / newValues
- [ ] UTC timestamps في الـ DB
- [ ] لا `prisma.auditLog.update()` ولا `delete()` في الـ code
- [ ] لـ financial: SUNK_COST / REVERSAL entries بدل الـ delete
- [ ] لـ exports: meta-audit (audit للـ export نفسه)
- [ ] الـ entity history endpoint متاح
- [ ] جربت scenario: "محامي طلب proof لـ X action" — نقدر نرجع كل التفاصيل؟
