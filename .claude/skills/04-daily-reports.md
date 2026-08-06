---
name: daily-reports
description: Use when working with the Updates module (daily progress reports), DailyUpdateTracker, the update workflow (DRAFT/PENDING/APPROVED/REJECTED/FORCE_CANCELLED), or any code that touches site engineer submissions, reviews, or version history. Enforces immutability, server-side timestamps, ownership, deduplication, and client visibility rules.
---

# Daily Reports (Updates) — Business Rules

> ⚠️ التحديث (Update) هو **قلب النظام**. كل update معتمد = إنجاز محسوب، فلوس متحركة، تقدم مشروع.
> الـ updates هي الـ "ground truth" اللي العميل بيدفع عليها. أي bug هنا = نزاع قانوني أو مالي مباشر.

---

## Domain Glossary (الـ vocabulary المعتمد)

| Term | المعنى |
|---|---|
| **Update** | تقرير يومي يقدمه site engineer / supervisor / worker على مرحلة (Phase) |
| **DailyUpdateTracker** | سجل يومي بيتتبع: المستخدم X لازم يقدم update على المشروع Y في اليوم Z قبل الـ deadline |
| **Phase** | مرحلة من المشروع (حفر، خرسانة، تشطيب...) — الـ updates بتنزل عليها |
| **Submitter** | اللي قدم الـ update |
| **Reviewer** | PROJECT_MANAGER أو SUPER_ADMIN اللي راجع |
| **Lock window** | 24 ساعة بعد الاعتماد — بعدها الـ update مقفول للتعديل |
| **Force Cancel** | إلغاء update معتمد (SUPER_ADMIN فقط) — يعكس progress + يخلق SUNK_COST |

---

## State Machine (المعتمد — لا تكسره)

```
       (creator)
DRAFT ─────────▶ PENDING ─────────▶ APPROVED ──┐ (24h)
  ▲              │                              │
  │              │                              ▼
  └──────────────┴ REJECTED                 [LOCKED]
                  (back to draft on edit)
                                                │
                          (SUPER_ADMIN only)    │
                       FORCE_CANCELLED ◀────────┘
                       (reverses progress + creates SUNK_COST)
```

**Transitions المسموحة:**
| From | To | بواسطة |
|---|---|---|
| `DRAFT` | `PENDING` | submitter (الـ creator) |
| `DRAFT` | (delete) | submitter (DRAFT فقط قابل للحذف) |
| `PENDING` | `APPROVED` | PROJECT_MANAGER, SUPER_ADMIN |
| `PENDING` | `REJECTED` | PROJECT_MANAGER, SUPER_ADMIN |
| `REJECTED` | `DRAFT` | submitter (بعد التعديل) |
| `APPROVED` | (edit within 24h) | submitter — يخلق UpdateVersion |
| `APPROVED` | `FORCE_CANCELLED` | SUPER_ADMIN فقط |

**أي transition تانية = bug خطير. ارفض في الـ service.**

---

## القواعد الأساسية

### 1. Server-side Timestamps فقط — مفيش client timestamps

كل `submittedAt`, `reviewedAt`, `lockedAt`, `createdAt` بتتسجّل من الـ server.

✅ صح:
```typescript
async submit(user: JwtPayload, updateId: string, req: Request) {
  const update = await this.getOwnedUpdate(user, updateId);
  if (update.status !== 'DRAFT') throw new BadRequestException('...');

  return this.prisma.update.update({
    where: { id: updateId },
    data: {
      status: 'PENDING',
      submittedAt: new Date(),   // ✅ server time
    },
  });
}
```

❌ غلط — كارثة:
```typescript
async submit(dto: { submittedAt: string }) {
  // ⛔ attacker يبعت submittedAt = "2020-01-01" عشان يبدو إنه أرسله قبل الـ deadline
  return this.prisma.update.update({ data: { submittedAt: new Date(dto.submittedAt) } });
}
```

**ممنوع في DTOs:** `submittedAt`, `reviewedAt`, `createdAt`, `lockedAt`, `forceCancelledAt` — مفيش واحدة من دول تتقبل من client.

### 2. الـ Update بعد APPROVED ما يتعدلش ولا يتمسحش — إلا بـ rules محددة

✅ القواعد:
- **APPROVED + خلال 24 ساعة من `reviewedAt`**: الـ submitter يقدر يعدل، **لكن لازم يخلق `UpdateVersion`** (snapshot للقديم) + audit log
- **APPROVED + بعد 24 ساعة**: مقفول. حتى SUPER_ADMIN ما يقدر يعدل — لو فيه error، الطريق الوحيد هو `FORCE_CANCEL` + خلق update جديد
- **APPROVED + الـ DELETE**: ممنوع تماماً. الطريقة الوحيدة = `FORCE_CANCEL`
- **DRAFT أو REJECTED**: الـ submitter يقدر يعدل أو يحذف
- **PENDING**: مقفول للتعديل (في انتظار المراجعة). يقدر يلغي بس (يرجع DRAFT)

✅ صح (موجود في `updates.service.ts`):
```typescript
async editApproved(user: JwtPayload, updateId: string, dto: EditApprovedDto, req: Request) {
  const update = /* fetch with company check */;

  if (update.status !== 'APPROVED') throw new BadRequestException('يمكن تعديل المعتمدة فقط');
  if (update.isLocked) throw new ForbiddenException('التحديث مقفل — انتهت فترة التعديل');

  // 24h check
  if (Date.now() - update.reviewedAt.getTime() > 24 * 60 * 60 * 1000) {
    await this.prisma.update.update({ where: { id: updateId }, data: { isLocked: true, lockedAt: new Date() } });
    throw new ForbiddenException('التحديث مقفل — انتهت فترة التعديل (24 ساعة)');
  }

  // ✅ Snapshot قبل التعديل
  const versionCount = await this.prisma.updateVersion.count({ where: { updateId } });
  await this.prisma.updateVersion.create({
    data: {
      updateId,
      versionNumber: versionCount + 1,
      snapshot: { /* full current state */ },
      changedBy: user.userId,
      changeReason: dto.changeReason,  // ⚠️ السبب مطلوب
    },
  });

  // التعديل + audit log
}
```

**`changeReason` مطلوب** لأي تعديل بعد approval — مفيش تعديل مجهول السبب.

### 3. ممنوع تقريرَين لنفس المستخدم على نفس المشروع في نفس اليوم

الـ `DailyUpdateTracker` بـ unique constraint:
```prisma
@@unique([projectId, userId, date])
```

لكن الـ Update مش عليها unique constraint. **لازم نضيف check في الـ service:**

✅ صح:
```typescript
async create(user: JwtPayload, phaseId: string, dto: CreateUpdateDto, req: Request) {
  const phase = await this.getPhaseWithAccess(user, phaseId);

  // ✅ check duplicates لنفس اليوم
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const existing = await this.prisma.update.findFirst({
    where: {
      phaseId,
      submittedBy: user.userId,
      createdAt: { gte: today, lt: tomorrow },
      status: { in: ['DRAFT', 'PENDING', 'APPROVED'] },
      ...this.prisma.softDeleteFilter,
    },
  });

  if (existing) {
    throw new ConflictException(
      `لديك تحديث ${existing.status === 'DRAFT' ? 'مسودة' : existing.status === 'PENDING' ? 'قيد المراجعة' : 'معتمد'} على هذه المرحلة لليوم`,
    );
  }

  // ... باقي الإنشاء
}
```

**القاعدة:** مستخدم واحد + مرحلة واحدة + يوم واحد = update واحد فقط (active).

### 4. Notifications تلقائية على كل state transition

كل transition لازم يخلق notifications:

| Event | Notification لـ |
|---|---|
| `Update.submit()` (DRAFT→PENDING) | PROJECT_MANAGER + SUPER_ADMIN في الشركة (REVIEW_REQUEST) |
| `Update.approve()` | submitter (UPDATE_APPROVED) + CLIENT للمشروع (UPDATE_APPROVED) |
| `Update.reject()` | submitter (UPDATE_REJECTED) |
| `Update.forceCancel()` | submitter + كل reviewers سابقين + CLIENT (UPDATE_FORCE_CANCELLED) |
| `Update.editApproved()` | reviewer + CLIENT (UPDATE_EDITED_AFTER_APPROVAL) |
| Phase reaches 100% | PROJECT_MANAGER + CLIENT (PHASE_COMPLETED) |
| Daily deadline passed | SUPER_ADMIN + PROJECT_MANAGER (DEADLINE_MISSED) |

✅ Pattern:
```typescript
// بعد transaction الـ approve
await this.notificationsService.createMany([
  {
    userId: update.submittedBy,
    type: 'UPDATE_APPROVED',
    title: 'تم اعتماد تحديثك',
    body: `تم اعتماد التحديث "${update.title}" من قبل ${user.email}`,
    referenceType: 'update',
    referenceId: updateId,
    priority: 'NORMAL',
    channel: 'IN_APP',
  },
  ...(project.client ? [{
    userId: project.client.id,
    type: 'UPDATE_APPROVED' as const,
    title: 'تحديث جديد على مشروعك',
    body: `${update.title}`,
    referenceType: 'update',
    referenceId: updateId,
    priority: 'NORMAL',
    channel: 'IN_APP',
  }] : []),
]);
```

### 5. CLIENT بيشوف APPROVED فقط — كل state تاني مخفي

✅ صح (موجود):
```typescript
if (user.role === 'CLIENT') {
  where.status = 'APPROVED';   // override أي filter من الـ client
}
```

❌ غلط — تسريب:
```typescript
// لو CLIENT بعت ?status=DRAFT في الـ query، هيشوف الـ drafts
where.status = query.status as UpdateStatus;
```

**القاعدة:** للـ CLIENT، الـ status filter دايماً hardcoded لـ `APPROVED`. لا تخليه يفلتر هو.

### 6. CLIENT يشوف بس — مفيش edit / create / approve / reject / comment على updates

✅ صح:
```typescript
if (user.role === 'CLIENT') {
  throw new ForbiddenException('العملاء لا يمكنهم إنشاء تحديثات');
}
```

**العميل ممكن يعمل**:
- View APPROVED updates
- View media (signed URLs)
- إضافة `CHANGE_REQUEST` comment (لو الـ feature موجود) — يخلق notification لـ PM

**العميل ما يقدرش**:
- Edit أي update
- Create update
- Approve/Reject
- View DRAFT/PENDING/REJECTED/FORCE_CANCELLED
- View comments من نوع internal

### 7. Force Cancel — يعكس الـ progress + يخلق SUNK_COST

موجود في `updates.service.ts` بالفعل. **القواعد:**
- SUPER_ADMIN فقط
- `reason` إجباري
- يـ decrement `phase.progress` بـ `update.progressIncrement`
- يـ floor الـ progress عند 0 (مش negative)
- يـ recalculate الـ project progress
- لو الـ update فيه `cost > 0`، يخلق Payment بـ `type: SUNK_COST`
- audit log إجباري مع `reason`

**ممنوع:** force cancel على updates مش APPROVED. لو DRAFT/PENDING/REJECTED → استخدم soft delete أو reject عادي.

### 8. Geolocation (لو الـ feature بيتفعّل)

لو الـ مشروع بيطلب geo proof:
- `latitude` + `longitude` + `accuracy` يتسجّلوا في الـ Update
- مقارنة الـ coords مع `project.location` (تحويل geocode)
- لو المسافة > X متر → flag للـ reviewer
- **الإحداثيات بتتاخد من الـ device GPS لحظة الـ submit** — مش من client time
- audit log فيه الإحداثيات

```prisma
// schema addition
model Update {
  // ...
  submitLatitude   Decimal? @map("submit_latitude")  @db.Decimal(10, 7)
  submitLongitude  Decimal? @map("submit_longitude") @db.Decimal(10, 7)
  submitAccuracy   Int?     @map("submit_accuracy")  // meters
}
```

### 9. Media (الصور والوثائق) — signed URLs بس

كل media مربوط بـ update. التخزين في Supabase Storage. **مفيش public URLs.**

```typescript
async getMediaUrl(user: JwtPayload, mediaId: string) {
  const media = await this.prisma.media.findFirst({
    where: { id: mediaId, update: { phase: { project: { companyId: user.companyId } } } },
    include: { update: { include: { phase: { include: { project: true } } } } },
  });
  if (!media) throw new NotFoundException();

  // CLIENT ownership check
  if (user.role === 'CLIENT' && media.update.phase.project.clientId !== user.userId) {
    throw new NotFoundException();
  }

  // ✅ signed URL مع expiry 1 hour
  const { data, error } = await this.supabaseStorage
    .from('updates-media')
    .createSignedUrl(media.url, 3600);

  if (error) throw new InternalServerErrorException('فشل في توليد رابط الملف');
  return { url: data.signedUrl, expiresAt: new Date(Date.now() + 3600_000) };
}
```

شوف **`05-file-uploads.md`** للتفاصيل.

### 10. Daily Tracker — Deadlines

الـ `DailyUpdateTracker` بيتولّد cron job يومي:
- لكل user عنده `ProjectAssignment.isRequiredDailyUpdate = true`
- يخلق DailyUpdateTracker بـ status `PENDING`
- الـ `deadline` = من `project.dailyUpdateDeadline` (e.g. "17:00")

Cron job آخر بعد الـ deadline:
- لكل tracker لسه `PENDING` بعد الـ deadline → `MISSED`
- لو الـ update جه قبل الـ deadline → `SUBMITTED_ON_TIME`
- لو بعد الـ deadline → `SUBMITTED_LATE` + احسب `delayMinutes`
- ابعت notification لـ SUPER_ADMIN + PROJECT_MANAGER للـ MISSED

### 11. Project Status Changes — السبب إجباري

أي تغيير في `project.status` لازم يكون فيه `reason`. (موجود في `ChangeProjectStatusDto`).

✅ صح:
```typescript
async changeStatus(user, projectId, dto: ChangeProjectStatusDto, req) {
  // dto: { status: 'ON_HOLD', reason: 'انتظار تعديلات من العميل على المخططات' }
  if (!dto.reason || dto.reason.trim().length < 10) {
    throw new BadRequestException('سبب تغيير الحالة مطلوب (10 أحرف على الأقل)');
  }
  // ...
  await this.auditLog.log({ ..., reason: dto.reason });
}
```

**القاعدة:** أي state transition على entity مهم (Project, Update, Payment) لازم `reason` لو الـ transition بـ "negative" connotation (cancel, hold, reject, force).

---

## Validation Rules للـ Update Fields

| Field | Rules |
|---|---|
| `title` | required, 5-200 chars |
| `description` | optional, max 5000 chars |
| `workDone` | optional, max 2000 chars |
| `workRemaining` | optional, max 2000 chars |
| `workersCount` | int, 0-1000 |
| `workHours` | decimal(5,2), 0-24 |
| `materialsUsed` | array of `{ name, quantity, unit, cost }` — max 50 items |
| `cost` | decimal(15,2), 0 to 999_999_999.99 |
| `progressIncrement` | int, 0-100 |
| `rejectionReason` | required لـ reject, 10-1000 chars |
| `forceCancelReason` | required لـ force cancel, 20-2000 chars |
| `changeReason` | required لـ editApproved, 20-1000 chars |

---

## Anti-patterns

```typescript
// ⛔ 1. Edit on APPROVED بدون version snapshot
await prisma.update.update({ where: { id }, data: { workDone: 'edited' } });

// ⛔ 2. Hard delete على update معتمد
await prisma.update.delete({ where: { id } });

// ⛔ 3. CLIENT يبعت status filter
where.status = query.status;  // CLIENT يقدر يشوف DRAFTs

// ⛔ 4. Approve update مش PENDING
await prisma.update.update({ where: { id }, data: { status: 'APPROVED' } });  // skip state check

// ⛔ 5. Skip 24h lock check
if (true /* mistake */) { await editUpdate(); }

// ⛔ 6. Client-side timestamp
data: { submittedAt: dto.submittedAt }

// ⛔ 7. No reason on force cancel / reject
await this.forceCancel(updateId);  // مفيش reason

// ⛔ 8. Duplicate updates same day
// مفيش check قبل create

// ⛔ 9. Skip progress recalculation بعد approve/force-cancel
// الـ project.overallProgress هيبقى stale

// ⛔ 10. Force cancel على update مش APPROVED
// reverses progress increment اللي أصلاً مش موجود
```

---

## Checklist لأي PR في الـ updates module

- [ ] State transition check موجود ومحدد
- [ ] Server-side timestamp فقط
- [ ] DRAFT/PENDING/APPROVED/REJECTED/FORCE_CANCELLED scenarios all tested
- [ ] CLIENT role visibility محدودة لـ APPROVED
- [ ] Duplicate prevention check (same user/project/day)
- [ ] Audit log فيه `reason` للـ negative transitions
- [ ] UpdateVersion snapshot قبل أي edit-after-approve
- [ ] Notifications متبعتة للـ stakeholders الصحيحين
- [ ] Phase progress + Project overall progress متحدّثَين
- [ ] Cost > 0 على force cancel → SUNK_COST payment متخلق
- [ ] Media signed URLs (مش public)
- [ ] الـ transaction wraps كل الـ writes
