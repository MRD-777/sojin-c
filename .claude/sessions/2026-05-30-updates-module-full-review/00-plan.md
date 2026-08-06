# خطة التنفيذ — Updates Module Full Review

## المشكلة

الـ Updates module هو **قلب النظام** (skill 04): كل approved update = إنجاز محسوب + فلوس متحركة + progress في مشروع. الـ surface area كبير (10 service methods + 10 endpoints + state machine 5-state) والـ existing test coverage ضيّق (14 specs، 4 methods فقط).

بعد deep architectural read على `updates.service.ts` (874 سطر) + cross-referencing مع skill 04 (Daily Reports business rules) + skill 07 (Audit-inside-tx) + skill 03 (Auth/Security)، رصدت **7 ثغرات critical/high/medium**، **4 bugs medium/low**، و**2 decision points** محتاجة موافقة منك. كمان الـ DTOs الحالية ما بتطبقش الـ validation budget اللي مكتوب في skill 04 ("Validation Rules للـ Update Fields").

---

## التحليل (Root Causes)

### المحور 1: Authorization filter bypass
- **`findAll` lines 71-83**: لما الـ user مش admin (SITE_ENGINEER/SUPERVISOR/WORKER/ACCOUNTANT)، الكود بـ apply الـ `OR: [submittedBy=me, status=APPROVED]` فقط **لما `query.status` مش set**. النتيجة: SITE_ENGINEER يبعت `?status=PENDING` ويشوف كل الـ PENDING updates في الـ phase (مش بس بتاعته). **violation لـ skill 04 rule 5 (وإن كان النص الـ explicit عن CLIENT، نفس الـ pattern ينطبق على non-admins).**
- Root: الـ OR clause بتـ apply كـ "default narrow"، لكن query parameter بـ bypass الـ narrow بدل ما يـ refine inside it.

### المحور 2: Idempotency integrity (CRITICAL)
- **`approve` line 441-446** و **`forceCancel` line 627-632**: الـ `idempotency.save` بتتم **بعد** الـ `$transaction` commit. لو الـ save failed (transient store error) → الـ user يشوف 500، يـ retry بنفس الـ Idempotency-Key → الـ `lookup` يـ return null → الـ tx بـ run تاني → **double-approval / double SUNK_COST / double progress mutation**.
- Root: الـ store الحالي (`InMemoryIdempotencyStore`) مش transactional مع PrismaService. الـ approval logic بتعتمد على "save بعد commit" pattern اللي مش atomic.

### المحور 3: TOCTOU race conditions
- **`create` lines 210-219**: الـ duplicate-guard `findFirst` بـ run **outside** الـ tx. اتنين requests متوازية من نفس الـ user على نفس الـ phase بـ pass الـ check ويـ create updates duplicate. الـ schema مفيهاش unique constraint بـ enforce الـ rule.
- **`forceCancel` lines 523-543**: بـ read الـ update + cost outside الـ tx. concurrent `editApproved` يقدر يـ تغيّر الـ cost بين الـ read والـ tx body → الـ SUNK_COST بـ get recorded بالـ stale cost.
- **`editApproved` lines 676-695**: `versionCount + 1` outside-tx-style read، مفيش unique constraint على `(updateId, versionNumber)` في الـ schema. اتنين edits متوازية → نفس الـ versionNumber لـ صفّين → history corrupted.

### المحور 4: Data integrity
- **`editApproved`**: ما بـ تـ recalc الـ phase progress لو الـ user عدّل الـ `progressIncrement` (e.g. 30→20 within الـ 24h window). الـ phase بتفضل بـ +30 contribution غلط. مفيش `recalculateProgressInTx` call. **نفس الـ Pattern في `forceCancel` لو الـ progressIncrement اتعدّل قبل الـ cancel.**
- **`editDraft` REJECTED→DRAFT cycle (lines 297-299)**: ما بـ تـ clear الـ `rejectionReason`. لو الـ update اتـ approve لاحقاً، الـ `rejectionReason` بـ يفضل في الـ DB → confusing for UI + audit trail dirty.

### المحور 5: IDOR / information disclosure
- **`findOne` line 158**: لما الـ CLIENT بـ يشوف update مش APPROVED، بـ throw `ForbiddenException`. الـ ForbiddenException بـ reveal "الـ update موجود لكن مش مسموحلك". الـ pattern الـ صحيح (المستخدم في lines 148-150 لـ tenant) = `NotFoundException`. **CVE-PROJ-001 من Session 2 fixed نفس الـ pattern في projects — لازم نفس الـ consistency.**
- **`findOne` line 165** نفس الـ pattern للـ non-admin field roles.
- **`getOwnedUpdate` line 869**: `ForbiddenException` لما الـ requester مش الـ submitter → reveals الـ existence cross-user. لازم `NotFoundException`.

### المحور 6: DTO validation gaps vs skill 04
الـ skill 04 section "Validation Rules" بـ يحدد ranges/limits صريحة. الـ DTOs الحالية ما بتطبقهاش. الـ table بـ يـ summarize الـ deltas في الـ Phase 6 section أسفل.

### المحور 7: ACCOUNTANT visibility (decision-required)
- Controller's `VIEWER_ROLES` بـ يـ include `ACCOUNTANT`، لكن `findOne` (lines 160-166) و `findAll` (lines 77-82) بـ يـ narrow visibility لـ "own + APPROVED" لأي role مش `SUPER_ADMIN`/`PROJECT_MANAGER`/`CLIENT`. النتيجة: **الـ accountant بـ يفقد visibility على الـ DRAFT/PENDING costs قبل الـ approval** — مش consistent مع function الـ role.
- Root: الـ admin-list في الـ visibility checks hardcoded اتنين بس بدل ما يـ include `ACCOUNTANT`.

---

## الحل المقترح

### المرحلة 1: Authorization filter hardening (CVE-UPD-001)
- **الملفات:** `updates.service.ts` (`findAll`)، `dto/index.ts` (`ListUpdatesQueryDto`).
- **التغييرات:**
  1. الـ `query.status` يـ apply كـ **additional AND filter داخل الـ OR narrow**، مش يـ bypass الـ narrow. الـ semantics الجديدة:
     - non-admin + no query.status → `OR: [{submittedBy: me}, {status: APPROVED}]`
     - non-admin + query.status='PENDING' → `AND: [{submittedBy: me}, {status: PENDING}]` (يشوف بس الـ own PENDING)
     - non-admin + query.status='APPROVED' → `{status: APPROVED}` (الـ approved كلها mubāḥa)
  2. `ListUpdatesQueryDto.status`: غيّر من `string` لـ `@IsEnum(UpdateStatus)` علشان أي قيمة غير صحيحة تـ reject بـ 400.
- **Risks:**
  - الـ UI القديمة لو بـ تـ send status='ANY' أو fallback غير-enum، هـ تـ break. **Mitigation:** الـ DTO تـ allow `@IsOptional()`؛ blank value behaves كـ "no filter".
  - تغيير الـ semantics للـ ACCOUNTANT depends على الـ Decision Point D2 (المحور 7) — لو D2 = "include ACCOUNTANT in admin tier"، الـ filter logic بـ تـ accept ACCOUNTANT في الـ admin branch.

### المرحلة 2: Idempotency-save inside tx (CVE-UPD-002)
- **الملفات:** `updates.service.ts` (`approve`, `forceCancel`)، `common/idempotency/idempotency.service.ts` (add `saveInTransaction(tx, ...)` overload)، `common/idempotency/in-memory-store.ts` (add `setInTransaction` lookup-by-tx or use deferred-queue pattern).
- **التغييرات:**
  1. Add `IdempotencyService.saveInTransaction(tx, tenantId, key, body, response)`. Because الـ store حالياً in-memory و مش Prisma-aware، الـ implementation الـ safest:
     - **Approach A (preferred):** غيّر الـ store من in-memory لـ Prisma table (new `idempotency_records` model) + `saveInTransaction` بـ يـ insert via الـ tx. → schema migration واحد.
     - **Approach B (interim):** persist الـ key inside الـ tx using a marker Prisma write (e.g. `auditLog.note` نوع جديد)، ثم الـ in-memory cache بـ يـ catch-up post-commit. أبشع.
  2. `approve` و `forceCancel`: انقل الـ `idempotency.save` لـ `saveInTransaction(tx, ...)` داخل الـ existing `$transaction` body.
- **Risks:**
  - **CRITICAL DECISION (D1):** Approach A بـ touches `IdempotencyService` و الـ schema → خارج "Updates module only". لكن الـ scope بـ يـ allow "schema migration إلا لو CRITICAL". الـ idempotency hole هي CRITICAL لأنها بـ تـ enable double-money-mutation. **هـ recommend Approach A** — schema migration inline لـ table جديد.
  - الـ migration بـ يـ touch الـ db schema → الـ tester لازم يـ regenerate Prisma client + يـ run migration locally قبل الـ specs.
- **Mitigation:** الـ migration name: `add_idempotency_records_table`. الـ table بـ unique على `(tenant_id, key)`. الـ in-memory store بـ يـ deprecate لكن مش بـ يـ delete (لـ بـ smoke-test compatibility حال احتياج).

### المرحلة 3: TOCTOU fixes (CVE-UPD-003 / CVE-UPD-005 / CVE-UPD-007)
- **الملفات:** `updates.service.ts` (`create`, `forceCancel`, `editApproved`)، optionally `schema.prisma` لـ unique على `(updateId, versionNumber)`.
- **التغييرات:**
  1. **`create`**: نقل الـ duplicate-guard check **داخل** الـ `$transaction` body مع `isolationLevel: 'Serializable'`. لو الـ check found existing → throw داخل الـ tx ليـ rollback نظيف. **Plus:** add Prisma partial unique index `(phaseId, submittedBy, createdAt::date)` WHERE status IN ('DRAFT','PENDING','APPROVED') AND deleted_at IS NULL — الـ DB-level guarantee. الـ index بـ يـ use `createdAt::date` لـ UTC-day boundary، الـ service بـ يحتفظ بالـ tz-aware check لـ user-facing error message + multi-day tz support.
     - **Note:** الـ DB index بـ يـ catch race على نفس الـ UTC day، لكن الـ service check بـ يـ catch tz-day duplicates (e.g. user في Cairo يـ submit 23:30 local = 21:30 UTC، ثم 00:30 local = 22:30 UTC — UTC same day، tz different day). الـ tz check رئيسي، الـ DB check defense-in-depth.
  2. **`forceCancel`**: re-read الـ update **داخل** الـ tx بـ `tx.update.findFirst` (status + cost + progressIncrement freshness). compare مع الـ pre-tx read؛ لو status اتغيّر، throw ConflictException ليـ rollback. **OR** الـ simpler approach: just re-read inside tx و use fresh values؛ الـ Serializable isolation بـ يـ guarantee الـ rollback تلقائياً لو conflicting tx commit جانبياً.
  3. **`editApproved`**: نقل الـ version snapshot inside tx مع `isolationLevel: 'Serializable'`. Add `@@unique([updateId, versionNumber])` على `UpdateVersion` في schema — DB-level guarantee.
- **Risks:**
  - الـ partial unique index في Postgres بـ يحتاج raw migration (Prisma doesn't auto-generate partial indexes كاملة).
  - الـ Serializable isolation بـ يـ ادي higher retry rate تحت load — acceptable للـ approve/forceCancel (rare ops); needs eye على create (high frequency).

### المرحلة 4: editApproved progressIncrement recalc (CVE-UPD-004)
- **الملفات:** `updates.service.ts` (`editApproved`).
- **التغييرات:**
  1. لو `dto.progressIncrement !== undefined && dto.progressIncrement !== update.progressIncrement`:
     - delta = new - old
     - `tx.phase.update({ data: { progress: { increment: delta } } })`
     - cap [0, 100] بـ updateMany conditions (نفس approve pattern)
     - `recalculateProgressInTx(tx, projectId)` inside الـ same tx (C28).
  2. Audit الـ change بـ include old/new progressIncrement explicitly.
- **Risks:**
  - **DECISION POINT D3:** هل الـ progressIncrement edit-after-approval مسموح أصلاً؟ الـ skill 04 rule 2 يقول "submitter يقدر يعدل" لكن مش بـ يحدد الفصول. لو الـ rule = "money-moving fields locked"، الـ correct fix يبقى **منع edit الـ progressIncrement post-approval** بدل recalc. أبسط + أأمن. **Recommend:** lock progressIncrement + cost لـ APPROVED edits — only descriptive fields editable (title, description, workDone, workRemaining, workersCount, workHours, materialsUsed). أي تغيير في money-moving fields يـ require force-cancel + re-create.

### المرحلة 5: IDOR hardening (CVE-UPD-006 + BUG-UPD-011)
- **الملفات:** `updates.service.ts` (`findOne`, `getOwnedUpdate`).
- **التغييرات:**
  1. `findOne` line 158 (CLIENT non-APPROVED): `ForbiddenException` → `NotFoundException`.
  2. `findOne` line 165 (FIELD non-APPROVED non-own): `ForbiddenException` → `NotFoundException`.
  3. `getOwnedUpdate` line 869 (non-submitter): `ForbiddenException` → `NotFoundException`.
- **Risks:**
  - الـ UI/clients اللي بـ تـ branch على 403 vs 404 (e.g. "your access expired" vs "deleted") قد تتأثر. **Acceptable** — security > UX hint.

### المرحلة 6: DTO validation tightening per skill 04 (BUG-UPD-008)
- **الملفات:** `dto/index.ts`.
- **الفروقات + الـ fixes:**

| Field | Current | Skill 04 spec | Fix |
|---|---|---|---|
| `title` | `@IsString @MaxLength(300)` | required, 5-200 | `@IsString @MinLength(5) @MaxLength(200)` |
| `workDone` | `@MaxLength(5000)` | max 2000 | `@MaxLength(2000)` |
| `workRemaining` | `@MaxLength(5000)` | max 2000 | `@MaxLength(2000)` |
| `workersCount` | `@Min(0)` | 0-1000 | add `@Max(1000)` |
| `workHours` | `@Min(0)` | 0-24 | add `@Max(24)` |
| `materialsUsed` | `@IsArray` | max 50 items | add `@ArrayMaxSize(50)` |
| `cost` | `@Min(0)` | max 999_999_999.99 | add `@Max(999_999_999.99)` |
| `RejectUpdateDto.reason` | `@MaxLength(1000)` | required 10-1000 | add `@MinLength(10)` |
| `ForceCancelDto.reason` | `@MaxLength(1000)` | required 20-2000 | `@MinLength(20) @MaxLength(2000)` |
| `EditApprovedDto.changeReason` | `@IsOptional @MaxLength(500)` | required 20-1000 | `@IsString @MinLength(20) @MaxLength(1000)` (remove `@IsOptional`) |
| `ListUpdatesQueryDto.status` | `@IsOptional @IsString` | enum-only | `@IsOptional @IsEnum(UpdateStatus)` (يدعم Phase 1) |

- نفس الـ rules applied على `EditUpdateDto` (الـ partial form) بـ keep `@IsOptional` لكن الـ length/range bounds بـ apply.
- **Risks:**
  - الـ existing dataset قد يحتوي على values خارج الـ new bounds. **هذا الـ session بـ يـ tighten DTOs (input validation) فقط**، مش بـ يـ retroactively reject existing rows. أي migration للـ old data خارج الـ scope.

### المرحلة 7: editDraft cleans rejectionReason (BUG-UPD-009)
- **الملفات:** `updates.service.ts` (`editDraft`).
- **التغييرات:** لما `wasRejected === true`، add `rejectionReason: null`، `reviewedBy: null`، `reviewedAt: null` لـ الـ `update.update.data`. الـ audit `oldValues` بـ include الـ old reason للـ trail.
- **Risks:** mafiḥsh.

### المرحلة 8: ACCOUNTANT visibility (Decision Point D2)
- **مقترح:** add `'ACCOUNTANT'` إلى الـ admin-level tier في `findOne` lines 160-166 و `findAll` lines 77-82. الـ ACCOUNTANT يشوف كل الـ updates (DRAFT/PENDING/APPROVED) — they need cost visibility before approval to advise PM.
- **Risks:** policy decision. **يحتاج موافقة منك صراحة قبل التنفيذ.**

### المرحلة 9: MVT specs (≥20 specs new)
- الـ specs detailed في "تعريف النجاح" section أسفل.

---

## الـ Skills المطلوبة
- **Skill 04** (daily-reports) → State machine + validation rules + duplicate guard + CLIENT-APPROVED-only + notifications (deferred via D4) + force-cancel semantics.
- **Skill 07** (audit-compliance) → Audit-inside-tx contract، `logInTransaction` signature، `reason` على negative transitions.
- **Skill 03** (auth-security) → tenant isolation pattern، NotFound-vs-Forbidden للـ IDOR resistance، role-based filter narrowing.
- **Skill 08** (testing) → MVT discipline + paired assertions + Serializable tx-test patterns.

---

## نقاط القرار (تحتاج موافقة صريحة)

### D1 — Idempotency persistence approach
- **Option A (recommended):** Add `IdempotencyRecord` Prisma model + table، migrate الـ store، `saveInTransaction` overload. Schema migration inline. Closes CVE-UPD-002 atomically. الـ correct long-term answer.
- **Option B:** Keep in-memory store، add post-commit retry-loop على `idempotency.save` (e.g. 3 retries، then log alert). Doesn't close الـ race window fully — لو الـ process crashes between commit و save، الـ window بـ يفضل مفتوح.
- **My recommendation:** A. الـ in-memory store أصلاً مش production-grade (لا multi-instance، لا restart-survival). Migration لـ Prisma store بـ يـ kill two birds.

### D2 — ACCOUNTANT visibility
- **Option A (recommended):** ACCOUNTANT يشوف كل الـ updates (admin-tier visibility). Reason: cost line-items + materialsUsed تـ figure في الـ accounting قبل approval.
- **Option B:** ACCOUNTANT يـ بقى محدود بـ "own + APPROVED" نفس الـ field roles. Reason: read-only audit pattern.

### D3 — progressIncrement edit-after-approval
- **Option A (recommended):** **lock progressIncrement + cost لـ editApproved**. Money-moving fields immutable post-approval. أي تعديل = force-cancel + re-create. Simplifies logic + closes data-integrity risk.
- **Option B:** Allow edit + recalc phase progress + recalc project progress inside الـ tx. Larger code change.

### D4 — Notifications (skill 04 rule 4)
- الـ skill بـ يـ mandate notifications على كل state transition. الـ codebase **مفيهاش NotificationsModule حالياً** (checked: `ls modules/` = audit, auth, chat, comments, companies, health, media, payments, phases, projects, sub-contractors, updates, users).
- **Recommendation:** treat NotificationsModule كـ **cross-cutting infrastructure missing**، مش "Updates module debt". الـ session بـ يـ acknowledge الـ gap في `00-scope.md` "out-of-scope" أو إضافة بنود إلى الـ BACKLOG كـ NEW session.
- **NEEDS YOUR APPROVAL:** هل نوافق على defer Notifications إلى session منفصل (مش debt لـ Updates module review)؟ أو لازم نـ stub minimal contract في Updates module نفسه؟

---

## التأثير على الـ Codebase الحالي

| الملف | إيه اللي بـ يتغير |
|---|---|
| `apps/api/src/modules/updates/updates.service.ts` | Phases 1, 2, 3, 4 (لو D3=B), 5, 7, 8 — refactor heavy |
| `apps/api/src/modules/updates/dto/index.ts` | Phase 6 — tighten validation |
| `apps/api/src/modules/updates/updates.controller.ts` | Phase 1 wiring لو الـ DTO contract اتغير (status enum) |
| `apps/api/src/modules/updates/updates.module.ts` | لا تغيير (إلا لو notifications stub D4=stub) |
| `apps/api/src/modules/updates/updates.service.spec.ts` | Phase 9 — append ≥20 specs |
| `apps/api/src/common/idempotency/idempotency.service.ts` | Phase 2 (لو D1=A) — add `saveInTransaction` |
| `apps/api/src/common/idempotency/in-memory-store.ts` | Phase 2 (لو D1=A) — deprecate أو wire-around |
| `apps/api/src/common/idempotency/idempotency.module.ts` | Phase 2 (لو D1=A) — register Prisma-backed store |
| `apps/api/prisma/schema.prisma` | Phase 2 (D1=A): `IdempotencyRecord` model. Phase 3: `@@unique([updateId, versionNumber])` على `UpdateVersion`. Phase 3: partial unique index على `Update` (raw SQL migration). |
| `apps/api/prisma/migrations/` | 2 new migrations (idempotency table + version unique + update partial index) |

---

## تعريف النجاح

- [ ] Phase 1 (CVE-UPD-001): authorization narrow correct لكل combination role × query.status.
- [ ] Phase 2 (CVE-UPD-002): idempotency save inside tx، tx rollback يـ rollback الـ idempotency record، retry بـ نفس الـ key بـ يـ return cached.
- [ ] Phase 3 (CVE-UPD-003/005/007): create duplicate-guard inside Serializable tx + DB partial unique index. forceCancel re-reads inside tx. editApproved version snapshot inside Serializable tx + DB unique on (updateId, versionNumber).
- [ ] Phase 4 (CVE-UPD-004 / D3): per D3 choice — either lock money-moving fields or recalc-inside-tx with C28.
- [ ] Phase 5 (CVE-UPD-006 + BUG-UPD-011): NotFound consistency في all IDOR-prone branches.
- [ ] Phase 6 (BUG-UPD-008): كل الـ DTOs matching skill 04 validation table.
- [ ] Phase 7 (BUG-UPD-009): editDraft clears rejection state on REJECTED→DRAFT.
- [ ] Phase 8 (D2): ACCOUNTANT visibility per decision.
- [ ] **MVT: ≥27 specs مكتوبة وpassing** (إجباري — distributed كالتالي):

### MVT budget detail
| Method / area | Existing | New | Targets |
|---|---|---|---|
| `findAll` | 0 | **4** | (1) CLIENT hardcoded APPROVED ignoring query.status, (2) **CVE-UPD-001**: SITE_ENGINEER + ?status=PENDING sees only own PENDING, (3) admin sees all PENDING when filtering, (4) non-admin + no filter → own ∪ APPROVED |
| `findOne` | 0 | **4** | (1) CLIENT non-APPROVED → **NotFound** (CVE-UPD-006), (2) CLIENT APPROVED on other client's project → NotFound (tenant via clientId), (3) FIELD non-own non-APPROVED → **NotFound** (CVE-UPD-006 sibling), (4) cross-tenant returns NotFound |
| `create` | 0 | **4** | (1) CLIENT → Forbidden, (2) non-admin without assignment → Forbidden, (3) **CVE-UPD-003**: serialized duplicate-guard inside tx (simulate via mock-tx counter or 2nd-call assertion), (4) Cairo tz day boundary (computeDayBounds-paired primary action) |
| `editDraft` | 0 | **3** | (1) only DRAFT/REJECTED editable, (2) non-owner → **NotFound** (BUG-UPD-011), (3) **BUG-UPD-009**: REJECTED→DRAFT clears rejectionReason + audit captures it |
| `submit` | 0 | **2** | (1) DRAFT→PENDING + audit-in-tx, (2) empty title → BadRequest |
| `approve` | 6 | **2** | (1) **CVE-UPD-002**: idempotency.save called via tx (mock receives tx-bound call), (2) idempotency cache hit returns body without re-running tx (already in existing? — verify; add if missing) |
| `reject` | 1 | **1** | (1) cross-tenant returns NotFound |
| `forceCancel` | 4 | **2** | (1) **CVE-UPD-002**: idempotency.save inside tx, (2) **CVE-UPD-005**: re-read inside tx detects status change → rollback with ConflictException |
| `editApproved` | 4 | **3** | (1) **CVE-UPD-007**: version unique constraint enforced (test catches collision), (2) **CVE-UPD-004** per D3 choice: either reject progressIncrement edit OR recalc phase inside tx, (3) changeReason missing → BadRequest (DTO Phase 6 enforcement) |
| `getVersions` | 0 | **1** | (1) delegates to findOne ACL (CLIENT non-owner → NotFound) |
| `computeDayBounds` / `toUtcFromLocal` | 0 | **2** | (1) Cairo midnight boundary correctness, (2) invalid tz → fall back to UTC without throw |
| DTO validation | 0 | **2** | (1) ListUpdatesQueryDto.status rejects non-enum value, (2) EditApprovedDto.changeReason missing → 400 |

**Total: 14 existing + 27 new = 41 specs.**

### Paired assertions (Rule #4) checklist
- **CVE-UPD-002 spec**: assert الـ `idempotency.save` call captured الـ tx client (deepest mock layer) — مش assert "save called" surface-level.
- **CVE-UPD-003 spec**: assert الـ duplicate check ran inside الـ `$transaction` (mock the tx callback ينفذ الـ findFirst عبر الـ tx client).
- **CVE-UPD-004 spec (D3=B)**: assert phase.update called مع الـ delta correct INSIDE الـ same tx as audit.

---
⏸️ AWAITING APPROVAL
رد بـ "approve" للمتابعة. **أو** "edit: D1=B" / "edit: D2=B" / "edit: D3=A" / "edit: D4=stub" للتعديل في decision points. أو "edit: [نص آخر]" لـ refinement عام.

✋ تم المخطط — للدور التالي؟
