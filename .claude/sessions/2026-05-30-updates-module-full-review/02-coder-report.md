# تقرير المبرمج — Updates Module Full Review

> Session: 2026-05-30-updates-module-full-review
> Mode: Deep
> Decisions: D1=A (Prisma-backed idempotency)، D2=A (ACCOUNTANT admin tier)، D3=A (lock money fields)، D4=defer notifications.

---

## المرحلة 1: Authorization filter hardening (CVE-UPD-001) — ✅

**الملفات المعدّلة:**
- `apps/api/src/modules/updates/dto/index.ts`:
  - أضفت `import { IsEnum } from 'class-validator'` + `import { UpdateStatus } from '@prisma/client'`.
  - `ListUpdatesQueryDto.status`: من `@IsOptional() @IsString() status?: string` لـ `@IsOptional() @IsEnum(UpdateStatus, { message: 'حالة التحديث غير صالحة' }) status?: UpdateStatus`. أي قيمة غير enum بـ تتـ reject 400 قبل ما توصل للـ service.
- `apps/api/src/modules/updates/updates.service.ts`:
  - أضفت `ADMIN_TIER_ROLES` constant — `['SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT']` (D2=A).
  - استبدلت `findAll` filter block بالـ three-tier narrow:
    - **CLIENT** → `where.status = APPROVED` hardcoded.
    - **ADMIN_TIER** (PM/SUPER_ADMIN/**ACCOUNTANT**) → `where.status = query.status` لو موجود؛ مفيش submitter narrow.
    - **FIELD** (SITE_ENGINEER/SUPERVISOR/WORKER):
      - بدون filter → `OR: [submittedBy=me, status=APPROVED]`.
      - filter = APPROVED → `where.status = APPROVED` (universally visible).
      - filter = DRAFT/PENDING/REJECTED/FORCE_CANCELLED → `where.status = ... AND where.submittedBy = me`. **يقفل الـ CVE.**

**انحرافات عن الـ Plan:**
- طبّقت Phase 8 (ACCOUNTANT visibility) مع Phase 1 في نفس الـ commit للـ `findAll` لأن الـ filter logic بـ يتكرر مع `findOne` (الـ مرحلة 5). الـ `ADMIN_TIER_ROLES` constant بـ يـ centralize القرار D2=A، عشان الـ مرحلة 5 و 8 بقت trivial diffs بدل ما يتكرر الـ list في 3 أماكن.
- النتيجة: Phase 8 effectively split — Phase 1 wired ACCOUNTANT في `findAll`، الـ Phase 5 هـ wire-in في `findOne`، الـ Phase 8 بقى مراجعة بدل تنفيذ منفصل.

**ملاحظات:**
- الـ `query.status` كانت `string` ← `UpdateStatus` enum change بـ removed الـ `as UpdateStatus` cast من الـ service (كان implicit unsafe).
- الـ comment block للـ CVE-UPD-001 موجود inline في الـ service (lines ~75-83 بعد الـ تعديل) — يحكي الـ pattern السابق + الـ fix.

---

## المرحلة 2: Idempotency persistence inside tx (CVE-UPD-002, D1=A) — ✅

**الملفات المعدّلة/المضافة:**
- `apps/api/prisma/schema.prisma`:
  - أضفت `model IdempotencyRecord` (composite PK `[tenantId, key]`، `body: Json`، `expiresAt: DateTime`، index على `expiresAt`).
- `apps/api/prisma/migrations/20260530000000_add_idempotency_records_table/migration.sql`:
  - migration جديد، يخلق `idempotency_records` table + index.
- `apps/api/src/common/idempotency/prisma-store.ts` (جديد):
  - `PrismaIdempotencyStore` implements `IdempotencyStore`. الـ `setInTransaction(tx, ...)` overload بـ يـ accept `Prisma.TransactionClient`. الـ `upsert` بـ يضمن إن duplicate save (retry على نفس الـ key بنفس الـ payload) ما يـ crashش.
  - `get` بـ يـ lazy-evict الـ expired records.
- `apps/api/src/common/idempotency/idempotency.service.ts`:
  - الـ constructor injection من `InMemoryIdempotencyStore` لـ `PrismaIdempotencyStore`.
  - أضفت method `saveInTransaction(tx, tenantId, key, body, response, ttlSeconds)`.
  - refactored `save` ليـ shares `buildRecord` helper مع `saveInTransaction`.
  - الـ doc block بـ يـ explicit إن `saveInTransaction` هو الـ correct option لـ tx-wrapped endpoints.
- `apps/api/src/common/idempotency/idempotency.module.ts`:
  - الـ provider: `InMemoryIdempotencyStore` → `PrismaIdempotencyStore`. الـ deprecated `in-memory-store.ts` لسه موجود في الـ directory لكن مش مـ wired.
- `apps/api/src/common/idempotency/idempotency.service.spec.ts`:
  - الـ unit tests كانت تستخدم `InMemoryIdempotencyStore` المباشر. استبدلتها بـ `FakeStore` (in-test class) implements الـ same contract. كل الـ 7 unit tests passing.
- `apps/api/src/modules/updates/updates.service.ts`:
  - `approve`: نقل `idempotency.save(...)` لـ `idempotency.saveInTransaction(tx, ...)` **داخل** الـ `$transaction` body (Serializable). الـ `body` بـ يحتفظ بـ shape الـ response الـ committed.
  - `forceCancel`: نقل `idempotency.save(...)` لـ `idempotency.saveInTransaction(tx, ...)` داخل الـ tx. الـ `responseBody` بـ يـ constructed once قبل الـ tx ويـ reused.
- `apps/api/src/modules/updates/updates.service.spec.ts`:
  - أضفت `idempotencySaveInTransaction` mock للـ `IdempotencyService` provider. الـ existing assertions ما اتغيرتش (مفيش spec بـ يـ assert على `idempotencySave` direct).

**انحرافات عن الـ Plan:**
- الـ plan ذكر "deprecate in-memory store but keep file". اتنفذ بالظبط — `in-memory-store.ts` موجود untouched لكن مش مـ wired في الـ module.
- الـ `PrismaIdempotencyStore.setInTransaction` بـ يـ accept `PrismaService | Prisma.TransactionClient` عبر مشترك helper `setOn` — معماري أنظف من duplicating الـ upsert body.

**ملاحظات:**
- الـ migration ما اتـ apply-ish في الـ DB لأن السـ session unit-test-only. الـ schema change generates الـ Prisma client الجديد عبر `prisma generate`، اللي tsc بـ يـ verify عليه. الـ migration بـ يتـ apply في deploy (separate concern).
- الـ existing `idempotencyLookup` cached-path tests لسه passing لأن الـ cached path بـ يـ return قبل أي tx — مفيش tx لـ saveInTransaction ينضم له.

---

## Verification (literal)

### `prisma generate` (after schema additions)
```
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
✔ Generated Prisma Client (v7.7.0) to .\..\..\node_modules\@prisma\client in 476ms
Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
```

### `tsc --noEmit -p tsconfig.json` (api workspace)
```
EXIT=0
```
(zero output = clean.)

### `jest --testPathPatterns="(updates|idempotency)\.service\.spec"`
```
Test Suites: 2 passed, 2 total
Tests:       22 passed, 22 total
Snapshots:   0 total
Time:        15.995 s
Ran all test suites matching (updates|idempotency)\.service\.spec.
```
(14 existing updates specs + 7 idempotency-service specs + 1 (TTL/other) = 22، الـ baseline pre-session بـ يتطابق مع post-session count. مفيش regression.)

---

✋ تم Phase 1 + Phase 2 — للمراجعة قبل الـ Phases 3 + 4؟

---

## المرحلة 3: TOCTOU fixes (CVE-UPD-003 / CVE-UPD-005 / CVE-UPD-007) — ✅

**الملفات المعدّلة/المضافة:**
- `apps/api/prisma/schema.prisma`:
  - أضفت `@@unique([updateId, versionNumber])` على `UpdateVersion` (CVE-UPD-007).
- `apps/api/prisma/migrations/20260530000001_update_versions_unique_per_update/migration.sql` (جديد):
  - migration راعي ينشئ `UNIQUE INDEX update_versions_update_id_version_number_key` + pre-flight audit query في الـ comment header لـ duplicates check قبل deploy.
- `apps/api/src/modules/updates/updates.service.ts`:
  - **`create`** (CVE-UPD-003): نقلت الـ `existingToday` check + الـ `create` + الـ audit-log كلهم **داخل** `$transaction` body بـ `isolationLevel: 'Serializable'`. لو الـ check وجد existing row → throw `ConflictException` داخل الـ tx ليرول back نظيف. الـ company timezone fetch (`prisma.company.findUnique`) لسه قبل الـ tx (read-only، مش race-prone).
  - **`forceCancel`** (CVE-UPD-005): انفصل الـ pre-tx read (fast-fail validation للـ existence/tenant/non-APPROVED) عن الـ in-tx re-read (authoritative source للـ cost/progressIncrement). الـ in-tx read بـ select الـ fields اللي بـ تـ matter بس (id, title, phaseId, status, cost, progressIncrement, phase.projectId). لو الـ re-read وجد status مش APPROVED → throw `ConflictException` (status flipped بين الـ reads بـ race).
  - **`editApproved`** (CVE-UPD-007): wrapped الـ `$transaction` بـ `isolationLevel: 'Serializable'`. الـ version snapshot لسه نفس الـ `versionCount + 1` pattern لكن مع الـ unique constraint الجديد + Serializable retry، الـ collision now causes الـ second tx يـ abort + retry بـ fresh count.

**انحرافات عن الـ Plan:**
- الـ plan ذكر "partial unique index في Postgres على `(phaseId, submittedBy, createdAt::date)` WHERE status IN ('DRAFT','PENDING','APPROVED')" كـ defense-in-depth لـ CVE-UPD-003. **ما اتنفذش** — السبب: الـ index بـ يحسب الـ date في UTC لكن الـ service بـ يحسبها في company timezone. النتيجة: 
  - false-positive blocks لـ legitimate submissions اللي بـ تـ cross midnight UTC جواه نفس الـ local day (مثلاً Cairo user يـ submit 23:30 local = 21:30 UTC، ثم 01:30 local next day = 23:30 UTC same UTC day → الـ DB index بـ يـ block الـ ثاني خطأ).
  - الـ Serializable tx بدون الـ index بـ يـ guarantee atomicity sufficiently — Postgres write-skew detection بـ يـ abort الـ conflicting tx.
- النتيجة: في-tx Serializable check وحدها (مفيش DB index). موثّق inline في الـ service comment.

**ملاحظات:**
- الـ existing `forceCancel` specs (4) كانت تستخدم `findFirstUpdate` mock للـ pre-tx read فقط. الـ new in-tx re-read محتاج `tx.update.findFirst`. wired الـ mock الـ tx ليـ point لـ نفس الـ `findFirstUpdate` shared mock — الـ existing tests اللي بتستخدم `mockResolvedValue` (not `Once`) شغّالة بدون تعديل لأن الـ same value بـ يتـ returned للـ pre و in-tx reads (الـ no-concurrency scenario).
- أضفت declaration لـ `txUpdateCreate` mock في الـ spec setup (لـ future create() specs في Phase 9).

---

## المرحلة 4: Lock money-moving fields (D3=A) — ✅

**الملفات المعدّلة:**
- `apps/api/src/modules/updates/dto/index.ts`:
  - `EditApprovedDto` بقى **standalone class** (مش extends `EditUpdateDto` بعد كده). الـ class بـ تـ accept descriptive fields فقط: `title`, `description`, `workDone`, `workRemaining`, `workersCount`, `workHours`, `changeReason`. الـ money-moving fields (`cost`, `progressIncrement`, `materialsUsed`) **محذوفة**. مع `forbidNonWhitelisted: true` في الـ global ValidationPipe، أي request بـ يرسل واحد منها بـ 400.
  - الـ doc block للـ class يـ explain الـ D3=A rule + الـ workflow (force-cancel + re-create لـ money changes).
- `apps/api/src/modules/updates/updates.service.ts`:
  - `editApproved` data: الـ `tx.update.update(...).data` بقى يـ contain الـ descriptive fields فقط. الـ `dto.cost` / `dto.progressIncrement` / `dto.materialsUsed` references محذوفة (مش موجودة في الـ DTO أصلاً).
  - Audit `oldValues` snapshot بقى يـ capture الـ descriptive fields (title, description, workDone, workRemaining, workersCount, workHours) بدل title + cost فقط — يعكس الفعليّاً اللي ممكن يتغير.
  - الـ snapshot في `tx.updateVersion.create(...)` لسه يـ include الـ cost + progressIncrement + materialsUsed (immortalize الـ approved state — even if not editable now، الـ snapshot هو الـ ground truth لما الـ update اتـ approve).

**انحرافات عن الـ Plan:**
- مفيش. الـ plan كان explicit إن D3=A = lock money fields، الـ implementation literal.

**ملاحظات:**
- الـ existing editApproved specs (4) all use bodies مفيهاش cost/progressIncrement/materialsUsed (بتعدّل title بس). فالـ TS strip باركوس الـ `(dto as Record<string, unknown>)` cast على الـ audit newValues لسه clean.
- الـ Phase 6 (Validation tightening per skill 04) هـ يـ tighten الـ changeReason لـ required + 20-1000 chars. حالياً لسه `@IsOptional MaxLength(500)`.

---

## Verification (literal)

### `prisma generate` (after schema additions Phase 3)
```
✔ Generated Prisma Client (v7.7.0) to .\..\..\node_modules\@prisma\client in 369ms
Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
```

### `tsc --noEmit -p tsconfig.json` (api workspace)
```
EXIT=0
```

### `jest --testPathPatterns="(updates|idempotency)\.service\.spec"`
```
Test Suites: 2 passed, 2 total
Tests:       22 passed, 22 total
Snapshots:   0 total
Time:        4.779 s, estimated 11 s
Ran all test suites matching (updates|idempotency)\.service\.spec.
```
(15 updates + 7 idempotency = 22، same baseline post-Phase-1+2. صفر regression.)

### Full api jest sweep (cross-module regression check)
```
Test Suites: 2 failed, 20 passed, 22 total
Tests:       14 failed, 253 passed, 267 total
Snapshots:   0 total
Time:        18.442 s
Ran all test suites.
```
الـ 14 failing **pre-existing** (BACKLOG): ENV-SPEC-001 (8 من `common/config/env-validation.spec.ts`) + AUDIT-SPEC-001 (6 من `audit-log.service.spec.ts`). مفيش failure جديد من Phase 3/4.

---

✋ تم Phase 3 + Phase 4 — للمراجعة قبل الـ Phases 5 + 6؟

---

## المرحلة 5: IDOR hardening (CVE-UPD-006 + BUG-UPD-011) — ✅

**الملفات المعدّلة:**
- `apps/api/src/modules/updates/updates.service.ts`:
  - **`findOne` CLIENT branch** (CVE-UPD-006): الـ `ForbiddenException` لما الـ CLIENT بـ يحاول يشوف update مش APPROVED → `NotFoundException`. الـ message موحّد ('التحديث غير موجود') مع الـ tenant-check حواليه.
  - **`findOne` FIELD branch** (CVE-UPD-006): نفس الـ pattern — non-admin بدون own + status≠APPROVED → `NotFoundException`. كمان استبدلت الـ hardcoded `['SUPER_ADMIN', 'PROJECT_MANAGER']` بالـ `ADMIN_TIER_ROLES` constant — ACCOUNTANT (D2=A) بقى ضمن الـ admin tier للـ findOne زي findAll.
  - **`getOwnedUpdate`** (BUG-UPD-011): الـ ownership-failure throw من `ForbiddenException('يمكنك تعديل تحديثاتك فقط')` → `NotFoundException('التحديث غير موجود')`. نفس الـ enumeration-resistance posture.
- `apps/api/src/modules/updates/updates.controller.ts`:
  - `getVersions` @Roles: أضفت `'ACCOUNTANT'` للـ allow-list — للـ uniformity مع D2=A في findAll/findOne. الـ findOne ACL لسه يتطبق داخل الـ service (`getVersions` → `findOne` → visibility narrow)، فالـ ACCOUNTANT الـ legit بـ يـ pass، non-admin بـ يـ rejected في الـ service layer.

**انحرافات عن الـ Plan:**
- الـ plan ما ذكرش الـ `getVersions` controller-Roles change. أضفته للـ consistency مع D2=A، عشان ACCOUNTANT ما يتـ block على route-level بعد ما الـ service layer قبله. لو الـ principal يفضّل الـ getVersions يفضل PM/SUPER_ADMIN فقط، الـ rollback trivial (سطر واحد).

**ملاحظات:**
- `ForbiddenException` لسه imported + مستخدم في `create` (CLIENT block) و `editApproved` (24h lock) — مفيش dead import.

---

## المرحلة 6: DTO validation tightening per skill 04 (BUG-UPD-008) — ✅

**الملفات المعدّلة:**
- `apps/api/src/modules/updates/dto/index.ts`: rewrote بالكامل. الـ deltas vs skill 04 table:

| Field | Before | After |
|---|---|---|
| `title` (Create) | `MaxLength(300)` | `MinLength(5) MaxLength(200)` |
| `title` (Edit*) | `MaxLength(300)` | `MinLength(5) MaxLength(200)` |
| `workDone` | `MaxLength(5000)` | `MaxLength(2000)` |
| `workRemaining` | `MaxLength(5000)` | `MaxLength(2000)` |
| `workersCount` | `Min(0)` | `Min(0) Max(1000)` |
| `workHours` | `Min(0)` | `Min(0) Max(24)` |
| `materialsUsed` | `IsArray` | `IsArray ArrayMaxSize(50)` |
| `cost` | `Min(0)` | `Min(0) Max(999_999_999.99)` |
| `RejectUpdateDto.reason` | `MaxLength(1000)` | `MinLength(10) MaxLength(1000)` |
| `ForceCancelDto.reason` | `MaxLength(1000)` | `MinLength(20) MaxLength(2000)` |
| `EditApprovedDto.changeReason` | `@IsOptional MaxLength(500)` | **required** `MinLength(20) MaxLength(1000)` |

- الـ bounds مستخرجين كـ `const` عند رأس الملف (TITLE_MIN/TITLE_MAX/...) لـ single-source-of-truth — الـ Create + Edit + EditApproved بـ يـ share نفس الـ constants.
- الـ error messages بـ Arabic لكل bound جديد (consistent مع الـ existing style).

**انحرافات عن الـ Plan:**
- الـ plan أشار للـ `EditUpdateDto` partial form بدون mention للـ `MinLength` على title. أضفت `@MinLength(5)` على `EditUpdateDto.title` لأن الـ semantic invariant ("title 5-200 chars") يـ apply حتى في partial update — المستخدم ما يـ allowed-loش يـ downgrade title لـ 2 chars عبر PATCH.

**ملاحظات:**
- `editApproved` service: الـ tighten الـ `dto.changeReason` لـ required قطع الـ optional chain ضرورياً — الـ snapshot data + audit reason كانوا بـ يـ read direct `dto.changeReason`، الـ tightening فقط بـ يـ narrow الـ type من `string | undefined` لـ `string`. لا change في الـ service code من Phase 6 angle.
- TypeScript caught issue صغير: `dto as Record<string, unknown>` cast كان valid لـ class بـ يـ extend EditUpdateDto (index signature compatible)، بقى invalid لـ standalone class. الـ fix: spread `{ ...dto }` ثم cast. الـ semantics متطابقة (newValues = كل الـ DTO fields).

---

## المرحلة 7: editDraft REJECTED→DRAFT cleanup (BUG-UPD-009) — ✅

**الملفات المعدّلة:**
- `apps/api/src/modules/updates/updates.service.ts` (`editDraft`):
  - الـ data block بقى يـ conditionally clear `rejectionReason`, `reviewedBy`, `reviewedAt` لما `wasRejected === true`. الـ spread `...(wasRejected ? {...} : {})` يضمن الـ DRAFT update العادي (مش-من-REJECTED) ما يتـ touch reviewer fields.
  - الـ audit `oldValues` للـ wasRejected branch بقى يـ include `rejectionReason: update.rejectionReason` — الـ trail يحتفظ بـ السبب اللي اتـ cleared من الـ row.

**انحرافات عن الـ Plan:**
- مفيش.

**ملاحظات:**
- `getOwnedUpdate` بـ يـ return الـ full row (مفيش select narrow)، فـ `update.rejectionReason` متاح مباشرة. مفيش read extra محتاج.

---

## ملخص حتى نهاية Phase 7

| Phase | الـ Issue المغطّاة | Status |
|---|---|---|
| 1 | CVE-UPD-001 (filter bypass) + Phase 8 ACCOUNTANT في findAll | ✅ |
| 2 | CVE-UPD-002 (idempotency outside tx) + D1=A schema/store migration | ✅ |
| 3 | CVE-UPD-003 (create race) + CVE-UPD-005 (forceCancel race) + CVE-UPD-007 (version race) | ✅ |
| 4 | D3=A (lock money fields) | ✅ |
| 5 | CVE-UPD-006 (IDOR) + BUG-UPD-011 (ownership IDOR) + Phase 8 ACCOUNTANT في findOne | ✅ |
| 6 | BUG-UPD-008 (DTO validation per skill 04) | ✅ |
| 7 | BUG-UPD-009 (editDraft cleans rejection state) | ✅ |
| 8 | (مدموجة في Phase 1 + Phase 5) | ✅ |

---

## Verification (literal) — بعد Phase 5 + 6 + 7

### `tsc --noEmit -p tsconfig.json`
```
EXIT=0
```

### `jest --testPathPatterns="(updates|idempotency)\.service\.spec"`
```
Test Suites: 2 passed, 2 total
Tests:       22 passed, 22 total
Snapshots:   0 total
Time:        6.854 s, estimated 12 s
Ran all test suites matching (updates|idempotency)\.service\.spec.
```

### Full api jest sweep
```
Test Suites: 2 failed, 20 passed, 22 total
Tests:       14 failed, 253 passed, 267 total
Snapshots:   0 total
Time:        12.703 s, estimated 16 s
Ran all test suites.
```
نفس الـ baseline pre-Phase-5: 14 failures كلها **pre-existing** (ENV-SPEC-001 + AUDIT-SPEC-001 في BACKLOG). صفر new regression.

---

✋ تم Phase 5 + 6 + 7 — جاهز للـ Architect post-execution review؟

---

## المرحلة 8: NEEDS-CODER returned (CVE-UPD-008 / CVE-UPD-009 / PAY-IDEM-001 / retry wrapper) — ✅

> مصدر العودة: `03-hacker-report.md` فتح **NEEDS-CODER** (Rule #9).
> قرار المستخدم: طبّق الـ 4 fixes — بما فيهم سحب **PAY-IDEM-001** داخل الـ session (override لحدّ السكوب "no payments refactor"، لأن الـ fix نقل سطر داخل الـ tx الموجود) + **retry wrapper**.
> هذا الـ section إضافة تراكمية — لا overwrite لـ Phases 1–7.

### Fix 1 — CVE-UPD-008 (HIGH): in-tx status re-check في `approve`
**الملفات المعدّلة:**
- `apps/api/src/modules/updates/updates.service.ts` (`approve`):
  - أضفت in-tx re-read **قبل** أول write داخل الـ tx: `tx.update.findFirst({ where: {id, softDelete}, select: {id, status} })`. لو `!fresh || fresh.status !== 'PENDING'` → `ConflictException('تم تغيير حالة التحديث أثناء المعالجة — أعد التحميل')`.
  - السبب: الـ pre-tx PENDING check (السطر ~442) TOCTOU window؛ approve concurrent اتـ commit الأول بيخلّي Serializable عاجزة عن abort في الحالة المتباعدة (لا تداخل) → كان `phase.progress` بيـ double-increment. ده **نفس الـ guard اللي `forceCancel` خده في CVE-UPD-005**، وكان ناقص في `approve`.

### Fix 2 — CVE-UPD-009 (MEDIUM): normalize الـ cached/returned body في `approve`
**الملفات المعدّلة:**
- `updates.service.ts` (`approve`):
  - بنيت `responseBody` مُطَبَّع **مرة واحدة** داخل الـ tx (`cost: .toFixed(2)`، `workHours: Number(...)`، `submittedAt/reviewedAt/lockedAt: ?.toISOString() ?? null`، `createdAt/updatedAt: .toISOString()`)، وعملت له `saveInTransaction` ورجّعته. النتيجة: **first-call body === replay body** (قبلها كان first-call entity خام بـ Decimal/Date، والـ replay JSON-coerced).

### Fix 3 — PAY-IDEM-001 (HIGH، pulled-in): نقل idempotency.save داخل الـ tx في `payments.create`
**الملفات المعدّلة:**
- `apps/api/src/modules/payments/payments.service.ts` (`create`):
  - نقلت بناء `responseBody` + الـ idempotency persistence **داخل** الـ tx: `idempotency.save(...)` post-commit → `idempotency.saveInTransaction(tx, …)` جوّه الـ tx body، والـ `responseBody` (مُطَبَّع: `amount .toFixed(2)`، `date .toISOString()`) اتبنى داخل الـ tx واتـ returned. ده يقفل نفس CVE-UPD-002 على endpoint مالي (double-billing عند فشل الـ save + retry).
  - بدّلت الـ return من الـ entity الخام لـ `responseBody` المُطَبَّع (first-call === replay، نفس posture CVE-UPD-009).

### Fix 4 — Serializable retry wrapper (MEDIUM، defense-in-depth)
**الملفات المعدّلة/المضافة:**
- `apps/api/src/prisma/prisma.service.ts`:
  - أضفت `runSerializable<T>(fn, retries = 3)`: يلفّ `$transaction(fn, { isolationLevel: Serializable })` بـ retry على `PrismaClientKnownRequestError.code === 'P2034'` (Postgres 40001) مع jittered backoff؛ أي error تاني يـ propagate فوراً (لا retry). أضفت `Logger` + استيراد `Prisma`.
  - السبب: Prisma مابيعملش auto-retry لـ serialization failures؛ الـ wrapper بيخلّي الـ tx الخاسر يعيد المحاولة شفّافياً بدل 500 (تقييم #1 المخطط). كل retry بيعيد قراءة الحالة الطازجة، فالـ in-tx guards (status re-check) بتفضل صحيحة على كل محاولة.
- `updates.service.ts`: `approve` + `create` + `forceCancel` + `editApproved` → بدّلت `this.prisma.$transaction(fn, { isolationLevel: 'Serializable' })` بـ `this.prisma.runSerializable(fn)`. (`editDraft` / `submit` / `reject` فضلوا على `$transaction` العادي — مش Serializable ومش محتاجين retry.)
- `payments.service.ts`: `create` → `runSerializable`.

### Spec wiring (إبقاء الـ suites green — الـ MVT الجديد دور المختبر)
- `updates.service.spec.ts`:
  - أضفت `runSerializable` للـ PrismaService mock (delegates لـ `prismaTransaction(fn, {isolationLevel:'Serializable'})` — فالـ assertion على الـ isolation فضلت شغّالة).
  - `baseUpdate` في describe('approve') خد الحقول اللي بيقراها الـ normalized body (`cost`, `workHours`, `createdAt`, `updatedAt`, `submittedAt/reviewedAt/lockedAt`) — وإلا `.toFixed`/`.toISOString` كانت هترمي على `{}`.
  - تلات `txUpdateUpdate.mockResolvedValue({})` في approve بقوا `{ ...baseUpdate, status: 'APPROVED' }`.
- `payments.service.spec.ts`:
  - أضفت `idempotencySaveInTransaction` mock + `runSerializable` للـ PrismaService mock + `saveInTransaction` للـ IdempotencyService provider.
  - test "saves the response": `idempotencySave` → `idempotencySaveInTransaction` (destructure بـ tx كـ arg 0) + أكّدت `idempotencySave` not called.
  - تلات "not.toHaveBeenCalled" خدوا سطر إضافي يأكّد `idempotencySaveInTransaction` كمان not-called في المسارات (cached / cancelled / rollback).

### انحرافات عن خطة الـ coder-return
- **مفيش.** الـ 4 fixes زي ما الهاكر اقترحهم في "الـ Fix المقترح للمبرمج". الوحيد extra: تعديلات الـ spec mocks (ضرورية لإبقاء الـ suites green بعد تغيّر السلوك — مش specs جديدة، دي للمختبر).

### ملاحظات للمراجع/المختبر
- **MVT جديد لسه ماتكتبش** — دور المختبر، **بعد** ما المخطط Stage 2 يـ approve الـ budget الجديد (Rule #9): CVE-UPD-008 (double-increment + happy path)، CVE-UPD-009 (shape parity)، PAY-IDEM-001 (saveInTransaction inside tx)، retry-on-P2034.
- الـ `runSerializable` ما اتغطّاش بـ unit test مباشر (الـ specs بتـ mock الـ PrismaService كله) — يُسجّل كـ MVT candidate للمختبر (test على الـ retry-loop بـ PrismaClientKnownRequestError mock).

---

## Verification (literal) — بعد المرحلة 8

### `npx prisma generate`
```
Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
```

### `npx tsc --noEmit -p tsconfig.json`
```
TSC_EXIT=0
```

### `npx jest --testPathPatterns="(updates|idempotency|payments)\.service\.spec"`
```
Test Suites: 3 passed, 3 total
Tests:       40 passed, 40 total
Snapshots:   0 total
Time:        17.417 s
Ran all test suites matching (updates|idempotency|payments)\.service\.spec.
```
(الـ WARN في الـ stdout = `IdempotencyService` بيـ log الـ 422-reuse path، وده test مقصود — مش failure.)

### Full api jest sweep
```
Test Suites: 2 failed, 20 passed, 22 total
Tests:       14 failed, 253 passed, 267 total
Snapshots:   0 total
Time:        18.476 s
Ran all test suites.
```
الـ 14 failures **نفس الـ baseline بالظبط** (ENV-SPEC-001 من `common/config/env-validation.spec.ts` + AUDIT-SPEC-001 من `modules/audit/audit-log.service.spec.ts` — الاتنين في BACKLOG). **253 passed = نفس الـ count قبل المرحلة 8. صفر new regression.**

---

✋ تم المبرمج (Stage 2 — NEEDS-CODER returned) — للمخطط Stage 2 (Hacker Proposal vs Reality)؟
