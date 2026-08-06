# تقرير المخطط (ما بعد التنفيذ)

## مقارنة Plan vs Reality

| البند | المخطط في `00-plan.md` | المنفّذ في الكود | متطابق؟ |
|-------|------------------------|-------------------|---------|
| F1 — موقع التعديل | `projects.service.ts:317-325` (assignMember member lookup) | `projects.service.ts:317-328` بعد التعليق التوضيحي | ✅ |
| F1 — enum values | `['SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER', 'FOREMAN']` *(Plan body)* + 4-role list *(Plan recommendation)* | `['SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER']` — 4 roles | ✅ (الـ FOREMAN في `ProjectRole` enum فقط — ليس في `UserRole`، فالـ exclusion صحيح؛ الـ Plan body كان فيه typo، الـ recommendation كانت الـ 4-role وهي المنفّذة) |
| F1 — error message | `NotFoundException('الموظف غير موجود')` (نفس رسالة الـ pre-existing — تجنّب user enumeration) | identical | ✅ |
| F2 — `findAll` | `where.project: { companyId, deletedAt: null }` | `phases.service.ts:57` exactly | ✅ |
| F2 — `findOne` | `where.project: { companyId, deletedAt: null }` | `phases.service.ts:84` exactly | ✅ |
| F2 — مس باقي phase mutations | غير مذكور صراحة (لكن `update`/`overrideProgress`/`reorder`/`softDelete` كلها بتـ call `findOne` أولاً، فمحمية transitively) | تم التحقق: الـ 4 mutations كلها بتمر عبر `findOne` المحمي بـ F2 | ✅ (transitive coverage |
| F2 — `create` | غير مطلوب تعديل (بيقرأ project explicitly بـ `softDeleteFilter`) | `phases.service.ts:107-114` لم يتغير، يستخدم `softDeleteFilter` على project | ✅ |
| F3 — حذف `recalculateProgress` public | `projects.service.ts:466-469` | محذوف بالكامل + الـ comment header اتبدّل لـ "Recalculate Overall Progress (in-tx only)" | ✅ |
| F3 — JSDoc update | "تحديث الـ spec" مذكور؛ الـ Plan لم يحدد JSDoc rewrite صراحة | المبرمج أعاد كتابة الـ JSDoc لـ `recalculateProgressInTx` (سطور 470-483) لإزالة المرجع للـ wrapper المحذوف مع الاحتفاظ بـ C28 historical context | ⚠️ (deviation **مقبول** — التعليق القديم كان فيه `Same as recalculateProgress() but ...` و `the previous implementation called recalculateProgress AFTER ...` — تركها يعني تعليقات stale تـ reference method مش موجودة) |
| F3 — spec cleanup locations | `updates.service.spec.ts` lines 62, 79, 117, 189 | تم الحذف في الـ 4 لوكيشن بالضبط (سطر 62 → declaration، 79 → jest.fn()، 117 → mock object key، 189 → assertion + comment) | ✅ |

**ملخص المقارنة:** 9 من 9 بنود متطابق (8 ✅ + 1 ⚠️ deviation مقبول).

---

## الانحرافات عن الـ Plan

### D1 — JSDoc rewrite لـ `recalculateProgressInTx` (سطور 470-483)

- **الانحراف:** الـ Plan قال "حذف الـ method تماماً + تحديث الـ spec". لم يحدد بشكل صريح إن الـ JSDoc لـ `recalculateProgressInTx` (المتبقية) لازم يُحدّث.
- **المبرمج فعل:** أعاد كتابة الـ JSDoc بالكامل (13 سطر) لـ:
  1. حذف الجملة `Same as recalculateProgress() but uses the caller's transaction client.` (تـ reference method محذوفة).
  2. حذف الفقرة `the previous implementation called recalculateProgress AFTER ...` وإعادة صياغتها للـ historical context.
  3. إضافة جملة `The non-tx wrapper has since been removed to keep this property at compile time — callers MUST pass a tx (or PrismaService for read-only contexts).`
- **المبرّر:** ترك الـ JSDoc القديم كان هيخلّي stale references لـ method محذوفة، وهو bad documentation hygiene. الإعادة صياغة محتفظة بـ C28 lineage والـ rationale.
- **مقبول؟** ✅ **مقبول** — هذا completion ضروري للـ F3، ليس scope creep. ولو المبرمج تركه، كان هيكون breakage معماري (تعليقات تـ reference غير موجودة).

**انحرافات أخرى:** لا يوجد.

---

## تقييم المعمارية

### ما تم فعله بشكل ممتاز

1. **F2 transitive coverage:** الـ F2 طبّق على `findAll` و `findOne` فقط (كما هو في الـ Plan)، لكن الـ نتيجة قفل cascade كامل: كل الـ phase mutations (`update`, `overrideProgress`, `reorder`, `softDelete`) بتبدأ بـ `findOne` للـ phase، فالـ filter `project: { deletedAt: null }` بيمنع mutation على phases تحت projects deleted **transitively** بدون code duplication. هذا pattern نظيف.

2. **F1 short-circuit before existing-check:** الـ ترتيب في `assignMember` صحيح — الـ `findFirst` بيـ throw قبل ما يصل لـ `existing` lookup. هذا يعني: لو data قديمة فيها CLIENT assignment (pre-F1)، محاولة reassign له هترفض بـ NotFound فوراً، لن تـ reach الـ ConflictException. الـ pre-F1 orphan data لا يقدر يُـ re-activated — defense-in-depth إضافي.

3. **F3 audit trail integrity:** المبرمج كتب grep verification صريح (`rg '\.recalculateProgress\b(?!InTx)'` = صفر matches) — هذا proof شامل إن الـ removal clean ولا في caller orphan.

4. **الـ verification literal كامل:** المبرمج التزم بـ rule #8 — الـ tsc stderr والـ jest stdout منقولين literally، بما فيهم الـ pre-existing failures الموثقة لـ BACKLOG #2.

### نقاط ضعف معمارية ⚠️

#### A1 — الـ Plan كان فيه gap: `PrismaService` overload لـ `recalculateProgressInTx` لسه ينقذ C28 surface

- **الموقع:** `projects.service.ts:484-486`
  ```ts
  async recalculateProgressInTx(
    tx: Prisma.TransactionClient | PrismaService,  // ← الـ overload
    projectId: string,
  )
  ```
- **المشكلة:** الـ Plan قال إن F3 "بيـ enforce الـ pattern at compile time" (سطر 30) و"TypeScript نفسه هو الـ guard الأقوى" (Plan F3 risk). لكن **الـ signature لسه يقبل `PrismaService`**، فـ developer جديد يقدر يكتب:
  ```ts
  await this.projectsService.recalculateProgressInTx(this.prisma, projectId);
  ```
  **بعد** `$transaction` commit — وده بالضبط الـ C28 violation اللي F3 جاي يقفله. TypeScript مش هيـ catch ده.
- **الشدة:** 🟡 MEDIUM — surface ضعيف، لكن مش active bug. كل الـ callers الحاليين (`updates.service.ts:413, 615` + كل الـ Phases mutations) بـ `tx` فعلاً.
- **الـ JSDoc الجديد بيوسّع المشكلة:** الجملة `callers MUST pass a tx (or PrismaService for read-only contexts)` بتـ legitimize الـ overload، وده يفتح الباب لـ misuse مستقبلي.
- **التوصية:** session تالي — إما (أ) tighten الـ signature لـ `tx: Prisma.TransactionClient` فقط (يكسر الـ `PrismaService` overload للـ session 1.8)، أو (ب) إعادة صياغة الـ JSDoc لـ `for read-only callers, use a separate read method` بدون legitimization للـ direct `PrismaService` usage.

#### A2 — `ensureProjectAccess` لسه ما بيـ check `project.deletedAt`

- **الموقع:** `projects.service.ts:539-555`
- **المشكلة:** F2 قفل الـ Phases visibility surface (data leak عبر phase queries). لكن `ensureProjectAccess` نفسها هي الـ gate لكل الـ project-scoped access، وهي:
  - للـ CLIENT: `findFirst({ where: { id, clientId, companyId } })` — **لا softDeleteFilter**
  - للـ assignment-based roles: `projectAssignment.findFirst({ where: { projectId, userId, removedAt: null } })` — **لا project lookup أصلاً، فلا check لـ project.deletedAt**
  - لـ SUPER_ADMIN/PROJECT_MANAGER: returns immediately — no check
- **الـ Impact:** أي caller خارج Phases module يستخدم `ensureProjectAccess` كـ gate قد يـ leak access لـ project deleted. الـ `findOne` على Project نفسه محمي بـ `softDeleteFilter` separately (سطر 116) فالـ direct view محظور، لكن الـ access check itself أوسع.
- **الشدة:** يعتمد على ما يلاقي الهاكر — candidate لـ attack hypothesis #4 (scope) المُوسّعة.
- **التوصية:** هذا surface للهاكر يفحصه. لو لقى exploit فعلي → NEEDS-CODER في الـ stage التالي. لو لم يلق exploit → backlog للـ session 1.8.

### نقاط ضعف معمارية ❌

لا يوجد.

---

## حاجات محتاجة تتعمل في sessions قادمة

1. **A1 — Tighten `recalculateProgressInTx` signature** (Session 1.8 candidate): إما إزالة الـ `PrismaService` overload أو tightening الـ JSDoc.
2. **A2 — `ensureProjectAccess` deletedAt check** (Session 1.8 candidate لو الهاكر لم يفتحه كـ NEEDS-CODER في الـ stage الحالي).
3. **Data audit:** فحص الـ DB لو في `ProjectAssignment` records مع `User.role IN ('CLIENT', 'PROJECT_MANAGER', 'SUPER_ADMIN')` — orphan records من قبل F1، تحتاج cleanup. (low priority، write-only data integrity).
4. **`@prisma/client/runtime/library` migration** (BACKLOG #2): pre-existing، unaffected by this session لكن الـ verification هنا أكدت إنها لسه CI-blocker لو CI tightening.
5. **F4 reorder uniqueness** (deferred من هذه الـ session per user decision Q4): يحتاج migration لـ unique constraint على `(projectId, order)` + استراتيجية للـ existing ties.

---

## الحكم

⚠️ **APPROVED WITH NOTES**

**السبب:**
- الـ تنفيذ مطابق للـ Plan تماماً (9/9 بنود)، الـ deviation الوحيد (D1 — JSDoc rewrite) هو completion ضروري ومقبول.
- الـ MVT لسه ما اتعملش (مرفوع للمختبر بناءً على decision المستخدم — هذا hand-off متفق عليه، ليس انحراف).
- الـ "Notes" هي 2 architectural observations (A1 + A2) **متعلقة بالـ Plan نفسه**، ليس بالـ تنفيذ — الـ Plan كان فيه gap في tightening الـ surface (A1) وكان scope ضيّق (A2). هذه gaps موثقة هنا، وقابلة للتقاط في session 1.8 أو من الهاكر في الـ stage التالي من هذه الـ session.

**النقاط الـ CRITICAL لـ الهاكر في الـ stage التالي:**
- A2 candidate لـ attack hypothesis #4 — يجب فحصه فعلياً، لو exploit موجود → NEEDS-CODER.
- باقي الـ attack hypotheses (1-3, 5-10 من scope) لسه ما اتفحصتش بعد.

---

✋ تم المخطط (ما بعد التنفيذ Stage 1) — للدور التالي (الهاكر)؟

═══════════════════════════════════════════════════════════════
# مراجعة المخطط (ما بعد التنفيذ) — Stage 2 (بعد NEEDS-CODER return)
═══════════════════════════════════════════════════════════════

A2 prediction confirmed كـ CVE — الهاكر فتح CVE-PROJ-001 (CRITICAL، cross-tenant admin bypass، root cause في scope). الـ session رجعت للمبرمج، الـ fix طُبّق. هذه مراجعتي للـ stage 2.

## مقارنة Hacker Proposal vs Reality (Stage 2)

| البند | المقترح في `03-hacker-report.md` | المنفّذ في `projects.service.ts:550-577` | متطابق؟ |
|-------|----------------------------------|------------------------------------------|---------|
| Tenant gate قبل role-branch | `findFirst({ where: { id, companyId, ...softDeleteFilter } })` كـ first step | identical (سطور 551-558) | ✅ |
| Select narrow للـ project | `select: { id, clientId }` | `select: { id: true, clientId: true }` | ✅ |
| Throw type | `ForbiddenException` (ليس NotFound) لكل failures — info-leak prevention | جميع الـ 3 throws هي `ForbiddenException` (سطور 559, 565, 576) | ✅ |
| Admin short-circuit بعد gate | `if (['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)) return;` بعد الـ project lookup | identical (سطر 561) — موقع صحيح | ✅ |
| CLIENT ownership check | يستخدم الـ `project.clientId` المُسترجع، لا DB query منفصل | identical (سطور 563-568) | ✅ |
| Assignment-based path | كما هو، لكن الآن transitively tenant-safe | identical (سطور 573-576) + تعليق توضيحي مضاف | ✅ |
| الـ Arabic error message | نفس النص الموجود (`ليس لديك صلاحية الوصول لهذا المشروع`) | identical في الـ 3 throws | ✅ |
| JSDoc rationale | المقترح ضمنياً (لم يحدّد) | المبرمج أضاف 13 سطر JSDoc يوثّق الـ CVE history + الـ ForbiddenException rationale | ⚠️ (deviation **مقبول جداً** — توثيق ضروري لمنع regression؛ بدونه developer ثاني ممكن يـ revert "للـ performance") |

**ملخص:** 7/7 بنود functional متطابق سطراً بسطر. الـ deviation الوحيد (JSDoc الموسّع) إضافة قيمة، ليس فقدان.

---

## الانحرافات عن مقترح الهاكر (Stage 2)

### D2 — JSDoc الموسّع لـ `ensureProjectAccess` (سطور 536-549)

- **الانحراف:** الهاكر اقترح الـ fix بدون JSDoc تفصيلي. المبرمج أضاف 13 سطر JSDoc:
  - شرح للـ "tenant + soft-delete gate runs FIRST".
  - تاريخ الـ CVE: "Previously (pre-CVE-PROJ-001) admins short-circuited before any DB lookup".
  - مثال للـ exploit downstream: "downstream callers that trusted the contract (e.g. chat.findRooms)".
  - rationale لاختيار `ForbiddenException` بدل `NotFoundException`: "the existence/non-existence distinction itself is privileged information".
- **مقبول؟** ✅ **strongly accepted** — هذا anti-regression documentation. لو developer جديد لاحظ "لماذا admin يـ pay DB query؟" → يقرأ الـ JSDoc → يفهم الـ CVE → لا يـ revert. بدون الـ comment، الـ optimization-driven revert محتمل في session مستقبلية.

### D3 — التعليق الإضافي للـ assignment-based path (سطور 570-572)

- **الانحراف:** المبرمج أضاف تعليق توضيحي 3 سطور قبل الـ assignment lookup يشرح إن الـ project lookup الأول جعل الـ check transitively tenant-safe.
- **مقبول؟** ✅ — توضيح ضروري للقارئ المستقبلي لمنع "تكرار" الـ tenant check.

**انحرافات أخرى:** لا يوجد.

---

## تأكيد المخاوف من Stage 1 (A1، A2)

| المخاوف | الحالة بعد Stage 2 | تأكيد |
|---|---|---|
| **A1** — `recalculateProgressInTx` يقبل `PrismaService` overload (footgun، dormant) | لم يـ touched في Stage 2 | ⏸️ لسه session 1.8 candidate. **يجب فصله من A2 لأن A2 صار مغلق.** سأرفع الـ A1 منفرداً في "حاجات محتاجة تتعمل" تحت. |
| **A2** — `ensureProjectAccess` لا يـ check `project.deletedAt` | مغلق بشكل أنيق: الـ `softDeleteFilter` مدموج في الـ project lookup الأول لكل الـ roles | ✅ **مغلق** |
| **CVE-PROJ-001** — admin cross-tenant bypass | مغلق at-source — الـ 14 caller للـ `ensureProjectAccess` كلهم الآن مغطّون | ✅ **مغلق** |
| **CHAT-FOLLOWUP-001** — chat بدون defense-in-depth | exploit-path مغلق at-source، لكن الـ defense-in-depth gap لسه قائم | ⚠️ session 1.8 ticket (تفاصيل تحت) |

---

## أسئلة المستخدم — قراراتي المعمارية

### Q-S2-1: MVT budget 12 → 18+ spec — موافقتي؟

**✅ APPROVED — الـ budget الجديد 18 spec، مع الـ structure التالي:**

| Group | Specs (المختبر) | البحث |
|---|---|---|
| Projects MVT (Plan original) | 8 (#1-#8 من Plan تعريف النجاح) | بدون تغيير |
| Phases MVT (Plan original) | 7 (#1-#7 من Plan تعريف النجاح) | بدون تغيير |
| **`ensureProjectAccess` (Stage 2 إضافي)** | **6 (من 03-hacker-report.md توصيات للمختبر #1-#6)** | **مضاف الآن** |
| **Total** | **21 spec** (تجاوز الـ 18+ المطلوب) | **خادم الـ pattern #5 (re-attack new specs)** |

**Note:** الـ Plan الأصلي قال "≥12 specs". بعد Stage 2 الـ floor الجديد = 18. الـ scaffold يصل إلى 21 لو المختبر التزم بكل الـ scope + Stage 2 توصيات. هذا مقبول جداً ولا يـ schedule-blocker لأن:
- الـ 6 specs الإضافية كلها على نفس الـ `ProjectsService` class، نفس الـ test file (`projects.service.spec.ts`).
- نفس الـ mocking layer (Prisma `project.findFirst` + `projectAssignment.findFirst`).
- الـ paired-assertions على `ForbiddenException` thrown — simple unit pattern.

**الـ 6 specs الإضافية المطلوبة (من 03-hacker-report.md توصيات للمختبر):**

1. SUPER_ADMIN cross-tenant → `ForbiddenException` (paired-assertion على الـ throw).
2. PROJECT_MANAGER cross-tenant → `ForbiddenException`.
3. SUPER_ADMIN own-company + not-deleted → resolves (no throw، void return).
4. SUPER_ADMIN own-company + **deleted** → `ForbiddenException` (A2 closure).
5. CLIENT non-owner (own-company project) → `ForbiddenException`.
6. SITE_ENGINEER without active assignment → `ForbiddenException`.

**Pattern #5 (rule #5 — re-attack new specs by closing pattern):** الـ pattern اللي قفلناه في Stage 2 = "trust-without-verify عند الـ role-branch قبل الـ tenant gate". الهاكر لازم يـ re-attack الـ 6 specs الجدد ضد نفس الـ pattern — مثلاً، هل في paths أخرى في الـ codebase بـ trust-without-verify؟ الإجابة: نعم — `chat.findRooms` و `chat.createRoom`. هذا اتـ flag كـ CHAT-FOLLOWUP-001، **ليس** في الـ scope الحالي لكن للـ session 1.8.

### Q-S2-2: CHAT-FOLLOWUP-001 → session 1.8 ticket؟

**✅ APPROVED كـ session 1.8 ticket. السبب التفصيلي:**

الـ exploit-path **مغلق at-source الآن** (الـ admin لا يقدر يـ bypass `ensureProjectAccess`). لكن الـ chat module لسه يـ trust `ensureProjectAccess` بشكل أعمى بدون defense-in-depth الذي أضافوه 4 modules أخرى (payments, comments, sub-contractors, updates). هذا gap معماري يستحق التوثيق:

**Ticket suggested for `.claude/sessions/BACKLOG.md` (تحت "Session 1.8+ غير عاجل"):**

```
- **CHAT-FOLLOWUP-001** — chat.findRooms (chat.service.ts:26-44) و chat.createRoom
  (chat.service.ts:64-109) يستخدمان `ensureProjectAccess` كـ sole gate بدون
  `companyId: user.companyId` في الـ chatRoom query. الـ exploit-path مغلق
  at-source في Session 2 (CVE-PROJ-001 fix)، لكن الـ defense-in-depth pattern
  المعتمد من باقي الـ 4 callers مفقود هنا. الـ Fix: إضافة `project: { companyId:
  user.companyId, deletedAt: null }` في الـ chatRoom queries.
```

**ليه ليس inline-fix الآن:**
1. `chat` module خارج scope (الـ scope صراحة محصور في Projects + Phases).
2. الـ exploit-path مغلق بالفعل بـ CVE-PROJ-001 source-fix.
3. الـ defense-in-depth gap = hardening، ليس active CVE.
4. يحتاج scope review منفصل لـ chat module + specs لتغطية الـ gap الجديد.

**الـ Risk لو deferred:** لو CVE-PROJ-001 fix اتـ reverted بطريقة ما (refactor خاطئ، performance optimization)، الـ exploit يعود في chat. الـ defense-in-depth في chat يمنع الـ regression. الـ Risk يعتمد على عمر الـ JSDoc الذي أضفته في Stage 2 (D2) — لو الـ JSDoc يحمي من الـ revert فترة طويلة → الـ Risk منخفض. توصيتي: session 1.8 priority MEDIUM، **ليس HIGH**.

### Q-S2-3: Performance impact مقبول؟

**✅ APPROVED — مقبول للـ production الحالية.**

**التحليل التفصيلي:**

| Caller class | Before Stage 2 | After Stage 2 | Δ DB queries لكل request |
|---|---|---|---|
| Admin path (SUPER_ADMIN/PROJECT_MANAGER) | 0 (immediate return) | 1 (`project.findFirst` بـ PK lookup) | **+1** |
| CLIENT path | 1 (`project.findFirst` مع clientId في WHERE) | 1 (نفس الـ shape، الـ ownership الآن check في memory) | 0 |
| Assignment-based (SITE_ENGINEER, SUPERVISOR, ACCOUNTANT, WORKER) | 1 (`projectAssignment.findFirst`) | 2 (`project.findFirst` + `projectAssignment.findFirst`) | **+1** |

**القياس الكمي:**
- الـ `project.findFirst({ where: { id, companyId, deletedAt } })` على primary key index. expected: <1ms في prod.
- الـ 14 caller production code للـ `ensureProjectAccess` كلهم في request-scoped contexts (controller-handled). لا N+1 loops، لا batch processing.
- الـ hottest paths: `chat.findRooms` (page-level)، `payments.findAll` (page-level)، `phases.findAll` (page-level). كلها 1 call لكل request HTTP. الـ +1 query لكل request مقبول جداً.

**Mitigation strategies لو ظهرت bottleneck (future):**
1. **Per-request cache** عبر `RequestContext` — `ensureProjectAccess(user, projectId)` بنفس الـ projectId مرتين في نفس الـ request = 1 lookup. مفيد لـ `findOne` patterns مثل `payments.findOne` التي تستدعي `findFirst` ثم `ensureProjectAccess`.
2. **Combined query في الـ callers** — `findOne` patterns تقدر تـ pre-fetch الـ project + assignment في 1 transaction بدل الـ 2 separate calls.

**Mitigation موصى به الآن:** لا شيء. wait for evidence-based bottleneck.

**Anti-pattern لتجنبه:** caching الـ `ensureProjectAccess` decision عبر requests (per-user-session) — هذا يخلق stale-state vulnerabilities (مثلاً، assignment removed لكن الـ cache لسه active). الـ RequestContext-only caching آمن.

---

## تقييم المعمارية (Stage 2)

### ما تم فعله بشكل ممتاز

1. **Source-fix بدل caller-fix:** المبرمج اتجه للـ root cause في `projects.service.ts` بدل ما يـ patch chat module منفرداً. هذا يقفل الـ exploit عبر كل الـ 14 caller في move واحد، ويوحّد الـ contract المعماري. الـ alternative (patch chat فقط) كان هيـ leave the same trap للـ caller التالي اللي يـ trust `ensureProjectAccess`.

2. **JSDoc anti-regression (D2):** الـ 13 سطر JSDoc موثقة الـ CVE history + الـ `ForbiddenException` rationale. الـ next-developer (شهور من الآن) سيقرأها قبل ما يحاول "optimize" الـ admin path. هذا preventive engineering ممتاز.

3. **Narrow `select`:** المبرمج اختار `select: { id: true, clientId: true }` بدل ما يـ fetch الـ full project. هذا minimizes الـ memory footprint + الـ wire traffic.

4. **CLIENT path reuses الـ fetched data:** بدل ما يـ duplicate الـ DB query، الـ CLIENT branch يستخدم الـ `project.clientId` المُسترجع من الـ initial lookup. هذا keeps الـ CLIENT path at 1 query (لا regression).

5. **Throw consistency:** كل الـ 3 failure paths تـ throw `ForbiddenException` بنفس الـ Arabic message. الـ info-leak prevention rationale موثق في الـ JSDoc.

### نقاط ضعف معمارية ⚠️

#### A3 — `JwtPayload.role` لسه `string` (مش `UserRole` enum)

- **الموقع:** `common/decorators/current-user.decorator.ts:13` — `role: string`.
- **المشكلة:** الـ `['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)` و `user.role === 'CLIENT'` يعملان وقت runtime. لكن typo (مثلاً `'SUPER_AMDIN'`) لا يـ caught بـ TypeScript. لو الـ Prisma enum تغيّر (مثلاً `SUPER_ADMIN` → `OWNER`)، الكود سيـ silently fail.
- **الشدة:** 🟢 LOW (defensive، ليس active CVE).
- **التوصية:** session 1.8 ticket — tighten `JwtPayload.role: UserRole` + update الـ JwtStrategy validate لـ return الـ typed value.

### نقاط ضعف معمارية ❌

لا يوجد.

---

## حاجات محتاجة تتعمل في sessions قادمة (محدّث)

1. **A1 — Tighten `recalculateProgressInTx` signature** (مكرر من Stage 1، dormant — session 1.8 MEDIUM priority).
2. **A3 — Tighten `JwtPayload.role` type to `UserRole` enum** (جديد في Stage 2 — session 1.8 LOW priority).
3. **CHAT-FOLLOWUP-001 — chat module defense-in-depth** (جديد في Stage 2 — session 1.8 MEDIUM priority).
4. **PROJ-NOTE-001** — audit `newValues: dto` echo cleanup (Stage 2 — LOW priority informational).
5. **PROJ-NOTE-002** — assignMember orphan data audit/cleanup (Stage 2 — LOW priority، data integrity).
6. **F4 reorder uniqueness** (deferred Plan Q4 — session 1.8 candidate لو الـ schema migration mature).
7. **`@prisma/client/runtime/library` migration** (BACKLOG #2 — pre-existing).

---

## الحكم (Stage 2)

✅ **APPROVED**

**السبب:**
- الـ تنفيذ مطابق لمقترح الهاكر سطراً بسطر (7/7 بنود)، الـ 2 deviations (D2 JSDoc موسّع + D3 تعليق توضيحي) هما value-additions، ليسا scope creep.
- CVE-PROJ-001 (CRITICAL) **مغلق at-source**، A2 (subsumed) **مغلق**، CHAT-FOLLOWUP-001 (HIGH downstream) **مغلق transitively**.
- MVT budget الجديد (18-21 specs) **approved**.
- Performance impact (+1 query لـ admin/assignment paths) **approved لـ production الحالية**.
- لا new architectural issues، الـ 1 جديد (A3 — JwtPayload.role string) منخفض الشدة ومدوّن للـ session 1.8.

**هذا Stage 2 ينقل الـ session للأمام بدلاً من إعادتها — جاهز للمختبر.**

---

✋ تم المخطط (ما بعد التنفيذ Stage 2) — للدور التالي (المختبر مع MVT budget 18-21 specs)؟
