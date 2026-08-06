# تقرير الهاكر — Updates Module Full Review

> Session: 2026-05-30-updates-module-full-review · Mode: Deep
> Hacker mode (Rule #7): **attack-and-fix**
> المرجع: الكود الفعلي في `apps/api/src/modules/updates/*` + `apps/api/src/common/idempotency/*` + `apps/api/src/modules/payments/payments.service.ts` + `prisma/schema.prisma` + migrations.
> قاعدة مفروضة في هذه الجولة (user-mandated): أي **HIGH/CRITICAL في production code → NEEDS-CODER + Rule #9**.

---

## Attack Vectors المفحوصة

- [x] Authentication bypass — (layer الـ guard خارج الموديول؛ كل service method بتاخد `JwtPayload` موثوق) — لا جديد.
- [x] Authorization (IDOR, privilege escalation) — `findAll` tiers + `findOne` + `getOwnedUpdate` + `create` assignment.
- [x] Input validation (injection, overflow) — DTOs (Phase 6) + `ListUpdatesQueryDto` enum.
- [x] Tenant isolation — `companyId` على كل query + `getPhaseWithAccess`.
- [x] Business logic abuse — **approve double-increment** ⚠️ + money-field lock + editDraft cleanup.
- [x] Double submit / race conditions — **approve TOCTOU** ✗ / create Serializable / forceCancel re-read / editApproved unique.
- [x] File upload exploits — خارج الموديول (media module) — N/A.
- [x] Audit log tampering — audit-inside-tx متّسق؛ لا منفذ tampering جديد.
- [x] Idempotency integrity — **approve cached-body shape** ⚠️ + **payments post-commit save** ✗.
- [x] Serializable correctness بدون retry — **مؤكَّد** (تقييم #1 المخطط).

---

## الثغرات المكتشفة

### [CVE-UPD-008] approve — لا يوجد in-tx status re-check → double progress/completion mutation
- **الخطورة: HIGH**
- **الموقع:** `apps/api/src/modules/updates/updates.service.ts` — `approve` (السطور 426–509). تحديداً: الـ status guard (`if (update.status !== 'PENDING')`, السطر 442) يتم **خارج** الـ `$transaction`، والـ tx body (السطور 446–506) **لا يعيد قراءة الحالة ولا يتحقق منها** قبل ما يكتب `status: 'APPROVED'` ويزوّد `phase.progress` (السطور 448–461).
- **السيناريو (خطوة بخطوة):**
  1. الـ approver (PM/SUPER_ADMIN) يعمل double-click على "اعتماد". الـ decorator نفسه بيقول للـ client *"generate a fresh UUID per logical operation"* — فـ النقرتين ممكن تطلعا بـ **مفتاحين idempotency مختلفين** (K1, K2). حتى بنفس المفتاح، الـ window تحت موجود (انظر أدناه).
  2. R1: `lookup(K1)` → null. يقرأ الـ update → `PENDING`. يعدّي الـ check.
  3. R2: `lookup(K2)` → null. يقرأ الـ update → `PENDING` (لسه R1 ما committـش). يعدّي الـ check.
  4. R1 يدخل الـ tx، يكتب APPROVED، `phase.progress += increment`، recalc، audit، `saveInTransaction(K1)` → **COMMIT**.
  5. R2 يدخل الـ tx **بعد** commit R1 (staggered — مثلاً انتظر connection من الـ pool). الـ tx بتاع R2 **لا يتداخل زمنياً** مع tx بتاع R1، فـ Postgres Serializable **ما بيـ abort-وش** (الـ SSI بيكتشف التعارض بين tx متداخلة فقط). R2 يكتب APPROVED تاني (no-op على الـ status) لكن `phase.progress += increment` **مرة ثانية** → **double-increment**، ثم recalc يعيد حساب progress المشروع على رقم متضخّم.
- **ليه idempotency مش بتنقذ:** الـ gap بين `lookup` و `saveInTransaction` غير محمي. بمفتاحين مختلفين مفيش dedup أصلاً؛ وبنفس المفتاح، لو الـ lookup-تين رجعوا null قبل أي commit، الـ upsert على (tenant,key) بيـ overwrite بدون تعارض، فـ الحماية الوحيدة كانت هتكون abort من Serializable — وده **لا يحصل في الحالة non-overlapping**.
- **ليه Serializable مش بتنقذ:** في الحالة المتداخلة (overlap) فعلاً واحد بيـ abort بـ `40001/P2034` — لكن بما إن **مفيش retry wrapper** (مؤكّد في `prisma.service.ts`، تقييم #1)، النتيجة 500 للمستخدم. في الحالة المتباعدة (staggered) مفيش تداخل أصلاً → مفيش abort → **double-increment صامت يُحفظ**.
- **التأثير:** `phase.progress` (ومن ورائه progress المشروع، اللي السكوب بيوصفه كـ "إنجاز محسوب + فلوس متحركة") يتضخّم بصمت لكل update معتمد مرتين. corruption في completion% بدون أي error ظاهر. عدم اتساق صارخ: **`forceCancel` اتعالج بالظبط من نفس الـ TOCTOU (CVE-UPD-005) بـ in-tx re-read + ConflictException، لكن `approve` اتساب مكشوف.**
- **الإصلاح المطبق:** لا شيء inline — fix داخلي للموديول لكن القاعدة المفروضة (HIGH → NEEDS-CODER) بتمنع الإصلاح الصامت من الهاكر؛ يرجع للمبرمج (Rule #9). الـ Fix المقترح في القسم المخصّص أدناه.
- **الحالة: NEEDS-CODER ⚠️**

---

### [CVE-UPD-009] approve — cached idempotency body شكله entity خام (shape inconsistency)
- **الخطورة: MEDIUM**
- **الموقع:** `updates.service.ts` — `approve` السطر 500: `{ statusCode: 200, body: updated }`، حيث `updated` هو Prisma entity فيه `cost: Decimal`، `reviewedAt: Date`، `createdAt: Date`...
- **السيناريو:**
  1. أول call: الـ method بترجع `approved` (= `updated`) — entity خام: `cost` كائن `Decimal`، الـ dates كائنات `Date`. بعد serialize عبر HTTP layer بياخدوا شكل معيّن.
  2. الـ replay (cached): `lookup` بترجع `existing.body` المقروء من عمود `Json` (JSONB). الـ `Decimal` و `Date` اتـ serialized عند التخزين → عند الـ replay يرجعوا **string** (cost) و **ISO string** (dates).
  3. النتيجة: **شكل الـ response في الـ first-call ≠ الـ replay** لنفس العملية. client صارم (typed) ممكن يكسر على الـ replay.
- **المقارنة:** `payments.create` بتعمل الصح — بتبني `responseBody` مُطَبَّع (`amount: ...toFixed(2)`, `date: ...toISOString()`) وتـ cache نفسه (السطور 281–291). `approve` مش بتعمل التطبيع. `forceCancel` بتـ cache `responseBody` ثابت (`{message}`) فـ سليمة.
- **الإصلاح المطبق:** لا شيء inline — مرتبط بـ CVE-UPD-008 (نفس الـ method) ويـ غيّر شكل الـ first-call response (سلوك يحتاج تغطية المختبر)، فـ يُحزَم في نفس الـ coder return.
- **الحالة: NEEDS-CODER ⚠️ (bundled مع CVE-UPD-008)**

---

### [PAY-IDEM-001] payments.create — idempotency.save بعد الـ tx (نفس نمط CVE-UPD-002 على endpoint مالي)
- **الخطورة: HIGH (pre-existing — خارج حدود الموديول، scope-guarded)**
- **الموقع:** `apps/api/src/modules/payments/payments.service.ts` — `create`، السطر 286: `await this.idempotency.save(...)` يتم **بعد** الـ `$transaction` (السطور 239–277).
- **السيناريو:** نفس CVE-UPD-002 بالظبط: لو الـ tx commit نجح ثم `save` فشل (transient store/DB error بعد ما الموديول بقى Prisma-backed، أو crash بين الـ commit والـ save)، الـ retry بنفس الـ Idempotency-Key بيلاقي `lookup` → null → **يعيد إنشاء صف payment ثانٍ = العميل يتفوتر مرتين.** الـ store دلوقتي Prisma، و`saveInTransaction` موجود وجاهز — فـ الإصلاح بقى trivial وما عادش فيه عذر معماري.
- **ليه مرفوع هنا:** الـ session دي هي اللي عملت الـ store-swap (in-memory → Prisma) اللي مكّن `saveInTransaction`. سيبان أخطر endpoint مالي (payments) على النمط الـ racy القديم = **عدم اتساق محدَث بقرار الـ session** (وإن كان السطر نفسه pre-existing). تحت قاعدة "self-contained / مفيش debt يُدفَع لـ session تانية" + "HIGH في production → NEEDS-CODER"، ده مرشّح للسحب داخل الـ session.
- **التضارب مع السكوب:** `00-scope.md` بيقول "مفيش refactor للـ PaymentsService". لكن الإصلاح مش refactor — هو **نقل سطر واحد** جوّه الـ `$transaction` الموجود أصلاً (`save` → `saveInTransaction(tx, …)`)، نفس diff اللي اتعمل لـ approve/forceCancel. الـ blast-radius صفر تقريباً.
- **الإصلاح المطبق:** لا شيء — **قرار سحبه داخل الـ session أو دفعه للـ BACKLOG يحتاج موافقتك صراحة** (تعارض scope). توصيتي: اسحبه (الـ fix = سطر واحد + spec واحد).
- **الحالة: NEEDS-CODER ⚠️ (scope-guarded — محتاج قرارك)**

---

## تقييمات أُكِّدت / أُغلقت (attack-and-confirm)

### ✅ CVE-UPD-001 (filter bypass) — **مغلق فعلاً**
هاجمت `findAll` (السطور 92–110) بكل combination:
| الدور | query.status | النتيجة | آمن؟ |
|---|---|---|---|
| CLIENT | PENDING | `status=APPROVED` (الـ query مُتجاهَل) | ✅ |
| FIELD (SITE_ENGINEER) | PENDING | `status=PENDING AND submittedBy=me` — own PENDING فقط | ✅ الـ CVE مقفول |
| FIELD | APPROVED | `status=APPROVED` (universally visible) | ✅ |
| FIELD | (none) | `OR[submittedBy=me, status=APPROVED]` | ✅ |
| FIELD | قيمة غير enum | يُرفض 400 في الـ DTO (`@IsEnum`) قبل الـ service | ✅ |
| ADMIN_TIER | أي | free filter | ✅ (مقصود D2=A) |
محاولة حقن `OR` يدوي عبر query مستحيلة (الـ DTO enum-only). **مقفول.**

### ✅ CVE-UPD-003 / 005 / 007 (TOCTOU create/forceCancel/version) — **مغلقة** (مع caveat retry)
- `create`: الـ check + create + audit داخل Serializable tx (السطور 248–305). تحت تزامن: واحد يـ abort بـ P2034 → **مفيش double insert** (السلامة محفوظة)، لكن بدون retry wrapper المستخدم بياخد 500 بدل 409 نظيف (availability — مش security).
- `forceCancel`: in-tx re-read + `status !== 'APPROVED'` → ConflictException (السطور 620–640). **محمي** — وده بالظبط الـ guard اللي ناقص في approve.
- `editApproved`: Serializable + `@@unique([updateId, versionNumber])` (schema 505 + migration موجودة). الـ collision الثاني يـ abort. **محمي.**

### ✅ Tenant isolation + IDOR — **متّسقة**
كل denial path = `NotFoundException`: `findOne` (174–196)، `getOwnedUpdate` (977–986)، `approve/reject/forceCancel/editApproved` كلها تتحقق `companyId` وترجع NotFound. الـ idempotency composite PK = `(tenantId, key)` يمنع cross-tenant key collision. `getVersions` يفوّض لـ `findOne` (ACL). **مفيش enumeration leak.**

### ✅ DTO validation (Phase 6) — مطابق skill 04
فحصت `dto/index.ts`: الـ bounds كلها مطبّقة (title 5–200، workHours ≤24، cost ≤999_999_999.99، changeReason required 20–1000، materialsUsed ≤50). `EditApprovedDto` standalone بدون money fields → مع `forbidNonWhitelisted` أي `cost/progressIncrement/materialsUsed` يُرفض 400. **D3=A مقفول layer-DTO + layer-service.**

---

## تقييم #1 المخطط (Serializable بدون retry) — مؤكَّد، تصنيفه

- **مؤكَّد:** مفيش retry wrapper في `prisma.service.ts` (grep لـ retry/P2034/40001/isolationLevel = صفر). تعليقات الكود اللي بتقول "the client retries" = **افتراض غير مضمون.**
- **التصنيف:** بمعزل عن CVE-UPD-008، الـ no-retry هو **availability/correctness degradation مش CVE مستقل** — لأن الـ abort بيحفظ السلامة (مفيش double insert/approve في الحالة المتداخلة)، بس بيطلع 500. **لكنه يـ amplify بلاست CVE-UPD-008**: في الحالة المتداخلة approve يطلع 500 بدل نجاح، وفي المتباعدة يـ double-increment. التوصية: retry helper (3x على P2034 مع backoff) حوالين الـ Serializable `$transaction` في `PrismaService` — يفيد create/approve/forceCancel/editApproved/payments دفعة واحدة. **يُحزَم مع الـ coder return كـ MEDIUM defense-in-depth (مش blocker مستقل).**

---

## ملخص الإصلاحات
- CRITICAL: 0 لقى → 0
- HIGH: 2 لقى (CVE-UPD-008، PAY-IDEM-001) → اتصلح: 0 → **NEEDS-CODER**
- MEDIUM: 2 لقى (CVE-UPD-009، Serializable no-retry) → اتصلح: 0 → bundled NEEDS-CODER / توصية
- LOW: 0
- **NEEDS-CODER: الـ session يتوقف ويرجع للمبرمج (Rule #9).**

## ثغرات لسه مفتوحة (مع مبرر)
- **PAY-IDEM-001**: مفتوح لحد قرارك (تعارض scope — سحب داخل الـ session vs BACKLOG).

---

## الـ Fix المقترح للمبرمج (Rule #9 — named section)

### Fix 1 — CVE-UPD-008 (HIGH، إجباري): in-tx status guard في `approve`
داخل `$transaction` بتاع `approve` (`updates.service.ts` ~447)، **قبل** أول write، أضف re-read + guard — نسخة طبق الأصل من نمط `forceCancel`:

```ts
const approved = await this.prisma.$transaction(
  async (tx) => {
    // CVE-UPD-008: re-read status inside the tx. The pre-tx PENDING
    // check (line ~442) is a TOCTOU window — a concurrent approve that
    // committed first leaves Serializable unable to abort us (no tx
    // overlap), so without this guard phase.progress double-increments.
    const fresh = await tx.update.findFirst({
      where: { id: updateId, ...this.prisma.softDeleteFilter },
      select: { id: true, status: true },
    });
    if (!fresh || fresh.status !== 'PENDING') {
      throw new ConflictException(
        'تم تغيير حالة التحديث أثناء المعالجة — أعد التحميل',
      );
    }

    const updated = await tx.update.update({ /* ...كما هو... */ });
    // ...باقي الـ body بدون تغيير...
  },
  { isolationLevel: 'Serializable' },
);
```
- ملاحظة: ده يقفل الـ window حتى بدون retry wrapper. لو الاتنين متداخلين، واحد يـ abort (P2034)؛ لو متباعدين، الثاني يلاقي `status !== 'PENDING'` ويرمي Conflict — **مفيش double-increment في أي ترتيب.**

### Fix 2 — CVE-UPD-009 (MEDIUM): تطبيع الـ cached body في `approve`
ابنِ `responseBody` مُطَبَّع مرة واحدة، وأرجعه واستعمله للـ cache (نمط `payments.create`):
```ts
const responseBody = {
  ...updated,
  cost: updated.cost.toFixed(2),
  progressIncrement: updated.progressIncrement,
  reviewedAt: updated.reviewedAt?.toISOString() ?? null,
  // طبّع أي Decimal/Date آخر في shape الـ entity
};
await this.idempotency.saveInTransaction(
  tx, user.companyId, idempotencyKey, fingerprintBody,
  { statusCode: 200, body: responseBody },
);
// ...
return responseBody; // first-call و replay بنفس الشكل
```

### Fix 3 — PAY-IDEM-001 (HIGH، يحتاج موافقتك): نقل save جوّه tx في `payments.create`
لو وافقت على السحب: انقل الـ `idempotency.save` (السطر 286) لـ `idempotency.saveInTransaction(tx, …)` **داخل** الـ `$transaction` الموجود (السطور 239–277)، وابنِ الـ `responseBody` المُطَبَّع قبل/داخل الـ tx. diff مطابق لـ approve/forceCancel.

### Fix 4 — Serializable retry wrapper (MEDIUM، توصية): helper في `PrismaService`
`runSerializable<T>(fn)` يلف `$transaction(fn, {isolationLevel:'Serializable'})` بـ retry (≤3) على `P2034`. استبدل المواضع الخمسة تدريجياً. **اختياري لكن يرفع الـ availability ويـ neutralize 500-storms.**

---

## توصيات للمختبر (بعد عودة الـ coder + موافقة المخطط Stage 2 على الـ MVT budget)
اعمل tests للحالات دي (paired assertions، Rule #4):
- **CVE-UPD-008**: tx mock بيـ simulate الـ update صار APPROVED بين الـ pre-read والـ in-tx read → assert `ConflictException` + **assert `phase.update(increment)` اتنادى مرة واحدة بس** (deepest primary action — مش بس "throw").
- **CVE-UPD-008 happy path**: PENDING → APPROVED ينجح والـ in-tx re-read بيـ pass.
- **CVE-UPD-009**: assert الـ `saveInTransaction` body المُمَرَّر = نفس shape الـ return (cost كـ string، dates كـ ISO) — تطابق first-call/replay.
- **PAY-IDEM-001** (لو اتسحب): assert `saveInTransaction` اتنادى بـ tx client داخل الـ Serializable tx (مش `save` post-commit).
- **Serializable no-retry** (لو اتعمل wrapper): assert إعادة المحاولة على P2034 ثم النجاح.

---

✋ تم الهاكر — فتحت **NEEDS-CODER** (CVE-UPD-008 HIGH + CVE-UPD-009 MEDIUM؛ و PAY-IDEM-001 HIGH محتاج قرارك). حسب Rule #9 الـ session ترجع للمبرمج (Stage 2). للدور التالي؟
