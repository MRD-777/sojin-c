# تقرير المختبر — Updates Module Full Review

> Session: 2026-05-30-updates-module-full-review · Mode: Deep
> MVT budget معتمد من المخطط Stage 2 = **32 spec جديد** (27 أصلي + 5 NEEDS-CODER).
> الـ specs **مكتوبة فعلاً** (MVT discipline — مش checklist) وكلها passing.

---

## إحصائيات

- **MVT المطلوب: 32 / المكتوب: 34** ← متجاوز الحد الأدنى (≥)
- Tests written (new): **34** (30 updates + 1 payments + 3 prisma)
- Tests passing: **34 / 34** (الـ targeted suite كله 74 passed)
- Tests failing: **0 جديد**
- Full sweep: **287 passed / 14 failed / 301 total** — الـ 14 كلها pre-existing (ENV-SPEC-001 + AUDIT-SPEC-001 في BACKLOG)؛ **صفر new regression**
- الـ 5 NEEDS-CODER specs **كلها مكتوبة + passing** (إجباري):
  - CVE-UPD-008 ×2 · CVE-UPD-009 ×1 · PAY-IDEM-001 ×1 · `runSerializable` ×3 (يغطّي الـ +5 #5)
- **Bug جديد اكتُشف أثناء الـ testing + اتصلح inline: BUG-UPD-012** (راجع القسم أدناه)

### توزيع الـ 34 spec الجديدة مقابل الـ budget
| المنطقة | budget | مكتوب | ملف |
|---|:---:|:---:|---|
| findAll (CVE-UPD-001 narrow) | 4 | 4 | `updates.service.spec.ts` |
| findOne (CVE-UPD-006 IDOR) | 4 | 4 | » |
| create (dup-guard + assignment + tz) | 4 | 4 | » |
| editDraft (BUG-UPD-009/011) | 3 | 3 | » |
| submit | 2 | 2 | » |
| reject (tenant) | 1 | 1 | » |
| forceCancel (CVE-UPD-002/005) | 2 | 2 | » |
| editApproved (D3=A + CVE-UPD-007) | 3 | 2 | » |
| getVersions | 1 | 1 | » |
| computeDayBounds / toUtcFromLocal | 2 | 2 | » |
| DTO validation | 2 | 2 | » |
| **CVE-UPD-008** (NEEDS-CODER) | 2 | 2 | » |
| **CVE-UPD-009** (NEEDS-CODER) | 1 | 1 | » |
| **PAY-IDEM-001** (NEEDS-CODER) | 1 | 1 | `payments.service.spec.ts` |
| **runSerializable** (NEEDS-CODER) | 1 | 3 | `prisma.service.spec.ts` (ملف جديد) |
| **الإجمالي** | **33** | **34** | — |

> ملاحظة: الـ editApproved كتبت 2 بدل 3 (الـ "changeReason missing → 400" اتغطّى في describe('DTO validation') بدل describe('editApproved') — نفس الـ assertion، تفادي تكرار). صافي الـ MVT = 34 ≥ 32.

---

## Unit / Service Tests (الجديدة)

| الـ Test | إيه اللي بيختبره | النتيجة |
|---|---|---|
| findAll · CLIENT | `status` hard-forced APPROVED، `query.status` متجاهَل | ✅ |
| findAll · CVE-UPD-001 | SITE_ENGINEER + ?status=PENDING → own PENDING فقط (`submittedBy=me`) | ✅ |
| findAll · ADMIN_TIER | PM + ?status=PENDING → كل PENDING بدون submitter narrow | ✅ |
| findAll · FIELD no-filter | `OR[own, APPROVED]` | ✅ |
| findOne · CLIENT non-APPROVED | → NotFound (لا 403 leak) | ✅ |
| findOne · CLIENT other-client | → NotFound | ✅ |
| findOne · FIELD non-own non-APPROVED | → NotFound | ✅ |
| findOne · cross-tenant | → NotFound | ✅ |
| create · CLIENT | → Forbidden | ✅ |
| create · no-assignment | → Forbidden | ✅ |
| create · CVE-UPD-003 | dup-guard داخل tx يبلوك + `tx.update.create` ماتنادتش | ✅ |
| create · Cairo tz | dup-guard query بـ tz day-bounds (24h span) ثم create | ✅ |
| editDraft · APPROVED | → BadRequest | ✅ |
| editDraft · BUG-UPD-011 | non-owner → NotFound | ✅ |
| editDraft · BUG-UPD-009 | REJECTED→DRAFT يـ clear rejection state + audit يحتفظ بالـ reason | ✅ |
| submit · DRAFT→PENDING | transition + audit-in-tx | ✅ |
| submit · empty title | → BadRequest | ✅ |
| reject · cross-tenant | → NotFound | ✅ |
| editApproved · D3=A | الـ row write مفهوش cost/progressIncrement/materialsUsed | ✅ |
| editApproved · CVE-UPD-007 | versionNumber = count+1 | ✅ |
| getVersions · ACL | CLIENT non-owner → NotFound + `updateVersion.findMany` ماتنادتش | ✅ |
| computeDayBounds · Cairo | bounds 24h-span + تحتوي now | ✅ |
| computeDayBounds · invalid tz | UTC fallback بدون throw (بعد BUG-UPD-012 fix) | ✅ |
| DTO · ListUpdatesQueryDto | non-enum status → error؛ APPROVED → 0 errors | ✅ |
| DTO · EditApprovedDto | changeReason ناقص → error | ✅ |

## NEEDS-CODER Tests (إجباري — paired assertions على deepest primary action، Rule #4)

| الـ Test | الـ deepest primary action المؤكَّد | النتيجة |
|---|---|---|
| **CVE-UPD-008** · status flipped | `tx.phase.update` + `recalculateProgressInTx` + `saveInTransaction` **NOT called** → ConflictException (مفيش double-increment) | ✅ |
| **CVE-UPD-008** · happy path | `tx.phase.update` called **مرة واحدة** بـ `increment: 10` | ✅ |
| **CVE-UPD-009** · shape parity | الـ body المُمَرَّر لـ `saveInTransaction` (`calls[0][4].body`) **===** الـ return value؛ cost = '1500.50' (string)، reviewedAt = ISO | ✅ |
| **PAY-IDEM-001** · save-in-tx | `saveInTransaction.calls[0][0].payment.create === txCreatePayment` (الـ tx client)؛ `save` not called | ✅ |
| **runSerializable** · retry | P2034 ×2 ثم نجاح → `$transaction` 3 مرات، كلها `{isolationLevel:'Serializable'}` | ✅ |
| **runSerializable** · non-P2034 | error عادي → propagate فوراً، `$transaction` مرة واحدة | ✅ |
| **runSerializable** · budget | P2034 مستمر → بعد initial+2 retries يـ rethrow P2034 | ✅ |

## Business Logic Tests
| الـ Transition | متوقع | النتيجة |
|---|---|---|
| DRAFT → PENDING (submit) | مسموح + audit | ✅ |
| REJECTED → DRAFT (editDraft) | مسموح + clear rejection | ✅ |
| APPROVED → edit money fields | **ممنوع** (D3=A) | ✅ |
| PENDING → APPROVED (تزامن) | increment مرة واحدة فقط (CVE-UPD-008) | ✅ |
| APPROVED → FORCE_CANCELLED (status flip) | Conflict عند تغيّر الحالة (CVE-UPD-005) | ✅ |

## Security Tests
| الهجوم | النتيجة |
|---|---|
| Tenant isolation (findOne/reject cross-tenant) | ✅ NotFound |
| IDOR / enumeration (findOne, getOwnedUpdate, getVersions) | ✅ NotFound موحّد |
| Privilege escalation (CVE-UPD-001 FIELD ?status filter) | ✅ مقفول |
| Double submit / idempotency (CVE-UPD-008, PAY-IDEM-001) | ✅ |
| Race / TOCTOU (CVE-UPD-003/005/008) | ✅ |
| Input validation boundary (DTO enum + changeReason) | ✅ |

## Regression Tests
- Full api sweep: **287 passed / 301** — كل الموديولات الأخرى (projects, phases, auth, sub-contractors, comments, media...) خضرا. صفر new failure.
- Payments idempotency (blast-radius Phase 2): الـ suite كامل passing بعد تبديل الـ store + الـ saveInTransaction migration. ✅

---

## Bugs اتكشفت أثناء الـ Testing

### BUG-UPD-012 — `computeDayBounds` invalid-tz fallback ناقص → أُصلح inline ✅
- **الموقع:** `updates.service.ts` — `computeDayBounds` / `toUtcFromLocal`.
- **المشكلة:** الـ fallback لـ UTC كان بيغطّي الـ **first** `Intl.DateTimeFormat` بس؛ بعدها الـ `timezone` الأصلي (غير الصالح) كان لسه بيتمرّر لـ `toUtcFromLocal`، اللي الـ `DateTimeFormat` بتاعه بيرمي `RangeError`. النتيجة: `Company.timezone` غير صالح = **500 على `create`** بدل UTC fallback نظيف.
- **ليه ده مهم:** يناقض تقييم المخطط Stage 1 #6 ("DST/timezone handling سليم ... fallback لـ UTC عند tz غير صالح"). الـ paired tz-test كشفه (الـ spec اللي الـ plan طلبه فعلاً صاد bug حقيقي — تأكيد لقيمة الـ MVT).
- **الإصلاح:** أضفت `effectiveTz` يبقى `'UTC'` لو الـ tz فشل، واتستخدم في `toUtcFromLocal` كمان. tsc EXIT 0، الـ spec بقى أخضر.
- **الحالة:** FIXED-IN-TESTING ✅ (fix داخلي للموديول، self-contained session).

---

## مناطق لسه محتاجة coverage (للـ principal awareness — مش blocker)
- **HTTP integration (supertest)**: كل الـ MVT service-layer (BACKLOG ticket #5 من Session 1.7) — Controller + Roles guard + ValidationPipe wiring لسه مش ممارَن end-to-end.
- **CVE-UPD-007 DB-level**: الـ `@@unique([updateId, versionNumber])` اتأكّد منطقياً (versionNumber=count+1)؛ الـ collision الفعلي يتأكّد عند migration apply (unit mock مايقدرش يفرض unique constraint حقيقي).
- **`runSerializable` تحت تزامن Postgres حقيقي**: الـ unit يـ simulate P2034 عبر mock؛ السلوك الفعلي تحت write-skew يحتاج integration.

---

## Verification (literal)

### `npx tsc --noEmit -p tsconfig.json`
```
TSC_EXIT=0
```

### `npx jest --testPathPatterns="(updates|payments|prisma|idempotency)\.service\.spec"`
```
Test Suites: 4 passed, 4 total
Tests:       74 passed, 74 total
Snapshots:   0 total
Time:        6.671 s, estimated 12 s
Ran all test suites matching (updates\.service|payments\.service|prisma\.service|idempotency\.service)\.spec.
```

### Full api jest sweep
```
Test Suites: 2 failed, 21 passed, 23 total
Tests:       14 failed, 287 passed, 301 total
Snapshots:   0 total
```
الـ 14 failures = ENV-SPEC-001 (`common/config/env-validation.spec.ts`) + AUDIT-SPEC-001 (`modules/audit/audit-log.service.spec.ts`) — **pre-existing في BACKLOG، صفر new regression**. الـ delta عن الـ baseline: 253→287 passed (**+34**)، 267→301 total (**+34**)، 22→23 suites (+1 = `prisma.service.spec.ts`).

---

## الحكم

✅ **READY** — كل الـ MVT (34 ≥ 32) passing، الـ 5 NEEDS-CODER specs مكتوبة بـ paired assertions على الـ deepest primary action، صفر new regression، و bug إضافي (BUG-UPD-012) اتكشف واتصلح داخل الـ session. tsc EXIT 0.

✋ تم المختبر — للمراجع الأعلى (Principal)؟
