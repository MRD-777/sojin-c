# تقرير الهاكر

## Attack Vectors المفحوصة

- [x] Authentication bypass (JwtStrategy validate)
- [x] Authorization (IDOR، privilege escalation عبر ensureProjectAccess)
- [x] Input validation (DTO + ValidationPipe whitelist)
- [x] Tenant isolation (cross-company data access)
- [x] Business logic abuse (state machine bypass، role gates)
- [x] Double submit / race conditions (assignMember concurrent، softDelete TOCTOU)
- [x] File upload exploits (N/A — no upload paths في الـ scope)
- [x] Audit log tampering (newValues echo، mass assignment via audit)
- [x] State machine bypass (Phase + Project transitions)
- [x] Math/overflow (recalculateProgressInTx weighted avg)
- [x] Dead-code reanimation (F3 recalculateProgress wrapper)
- [x] Architect post-exec observations (A1، A2) — converted to attack hypotheses

---

## الثغرات المكتشفة

### [CVE-PROJ-001] Cross-tenant data access for SUPER_ADMIN/PROJECT_MANAGER via `ensureProjectAccess`

- **الخطورة:** 🔴 **CRITICAL**
- **الموقع:** `apps/api/src/modules/projects/projects.service.ts:537-555` — `ensureProjectAccess(user, projectId)`
- **النص المُكتشف:**
  ```ts
  async ensureProjectAccess(user: JwtPayload, projectId: string): Promise<void> {
    if (['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)) return;  // ← لا verify إن projectId ∈ user.companyId
    ...
  }
  ```
- **الـ Root Cause:** للـ admin paths (SUPER_ADMIN + PROJECT_MANAGER) الدالة بترجع immediately **بدون verify إن الـ `projectId` ينتمي للـ `user.companyId`**. الـ assumption الضمنية هي إن الـ callers بيـ trust الـ check بالكامل، ولكن الـ implementation للـ admins هي trust-without-verify.

#### السيناريو (Production-reachable cross-tenant data leak)

**Setup:**
- شركة A: `userA` = SUPER_ADMIN عند Company-A.
- شركة B: لها `Project-B` (id ثابت) و `ChatRoom-B-1` تحت هذا الـ project.
- `Project-B.id` معروف للمهاجم (عبر OSINT، API enumeration، UUID disclosure في log، أو تخمين منخفض الـ entropy لو الـ UUIDs مش v4).

**Attack chain (production-reachable):**
1. `userA` يـ authenticate ويـ get JWT لـ Company-A.
2. `userA` يطلب `GET /api/v1/projects/{Project-B.id}/chat/rooms`.
3. Controller يستدعي `ChatService.findRooms(userA, Project-B.id)`:
   ```ts
   // chat.service.ts:26-44
   async findRooms(user: JwtPayload, projectId: string) {
     await this.projectsService.ensureProjectAccess(user, projectId);  // ← BYPASS (admin → return)
     const isAdmin = ['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role);  // ← true
     if (isAdmin) {
       return this.prisma.chatRoom.findMany({
         where: { projectId },  // ← لا companyId filter
         ...
       });
     }
     ...
   }
   ```
4. الـ response: chat rooms كاملة من Company-B تظهر للـ `userA` — names، types، participant counts، message counts.

**Demonstration بالـ POC (لا أنفّذ على prod):**
```
GET /api/v1/projects/{leaked-projectId-from-companyB}/chat/rooms
Authorization: Bearer {valid-jwt-of-superAdminA}

→ 200 OK
[{ "id": "...", "name": "Internal-CompanyB-Chat", "type": "GROUP", "_count": { "messages": 5234, "participants": 12 } }, ...]
```

**Extended exploit (write side):**
`ChatService.createRoom` (chat.service.ts:64-109) أيضاً يستخدم `ensureProjectAccess` فقط دون tenant gate ولا companyId-on-create. فالـ `userA` يقدر يـ create chat room تحت `Project-B`، الـ data persist في DB Company-B، **لكن** `sendMessage` و `getRoomWithAccess` يـ enforce explicit `room.project.companyId !== user.companyId` (سطر 206)، فلا يقدر يـ send messages لكن الـ room المخلوقة تظهر للـ Company-B's users كـ ghost room — **integrity/audit pollution attack**.

#### Reachability حتى لو حال الـ Projects/Phases المباشرة محمي

**Why this is reachable despite Projects/Phases بحد ذاتها safe:**

كل الـ في-scope mutations/reads في `ProjectsService` و `PhasesService` فيها explicit `companyId: user.companyId` filter كـ defense-in-depth:
- `projects.findOne`: `findFirst({ where: { id, companyId, ...softDeleteFilter } })` → cross-tenant rejected.
- `phases.findAll`: `findMany({ where: { project: { companyId, deletedAt: null } } })` → cross-tenant rejected (F2).
- `phases.findOne`: same.
- كل الـ Project mutations: `getOwnedProject(companyId, ...)` gate.

**الـ Bug effectively isolated داخل scopes Projects/Phases**. لكن `ensureProjectAccess` هي **API exported لـ 5 modules أخرى** كـ "the canonical access check":
- ✅ `phases.service.ts` (3 callers) — safe لأن كل query فيها explicit companyId.
- ✅ `payments.service.ts` (4 callers) — explicit comment line 78: *"Defense-in-depth: filter by company AND soft-delete, even though `ensureProjectAccess` already validated the project."* — الـ developer يفترض أن `ensureProjectAccess` validates company، **والـ implementation breaks that assumption لـ admins**.
- ✅ `sub-contractors.service.ts:140` — explicit `phase.project.companyId !== user.companyId` gate before `ensureProjectAccess`.
- ✅ `comments.service.ts:279` — explicit `update.phase.project.companyId !== user.companyId` gate.
- ✅ `updates.service.ts:756` — explicit `phase.project.companyId !== user.companyId` gate.
- ❌ **`chat.service.ts:findRooms` (line 26)** — لا gate. **EXPLOITABLE.**
- ❌ **`chat.service.ts:createRoom` (line 64)** — لا gate. **EXPLOITABLE (write/pollution).**

النمط المكشوف: 4 modules تعلموا بشكل ضمني أن `ensureProjectAccess` غير موثوقة وأضافوا defense-in-depth. Chat module لم يتعلّم. الـ contract المعماري مكسور: الـ function اسمها يوحي بـ access-check شامل، لكن الـ implementation للأدمين trust-blind.

#### التأثير
- **Confidentiality:** SUPER_ADMIN/PROJECT_MANAGER من أي شركة يقدر يقرأ chat room metadata من أي شركة (cross-tenant data leak).
- **Integrity:** نفس الـ role يقدر يكتب chat rooms كـ ghosts تحت projects شركات أخرى (data pollution، audit-trail confusion).
- **Compliance:** للـ multi-tenant SaaS هذا violation مباشر لـ tenant-isolation guarantee — أي fintech/GDPR audit يفشل.
- **Severity rationale:** لا يحتاج privilege escalation، الـ exploit بسيط (GET request)، الـ surface واسع (أي admin × أي projectId)، الـ secret needed (projectId) منخفض الـ entropy لو UUIDs ضعيفة أو لو يتسرّب عبر support/screenshots/logs.

#### الإصلاح المطلوب (architectural change → NEEDS-CODER)

**Why NEEDS-CODER and not FIXED-BY-HACKER:**
- الـ fix يضيف DB query لكل admin call عبر **5 modules** (chat, payments, sub-contractors, comments, updates، بالإضافة لـ phases/projects). performance implication يحتاج consideration.
- الـ change يتقاطع مع A2 (architect post-exec): الـ fix الصحيح يـ enforce **companyId + deletedAt** للأدمين، مش بس companyId. لو الفصل عن A2 → نقفل crit بـ companyId ونـ defer deletedAt → الـ A2 لسه exploitable في paths أخرى. الأنظف نـ tackle الـ 2 معاً.
- لا تغيير "single-line bracket" — الـ fix يضيف 3-7 سطور، يـ break الـ contract القديم (admins يـ pay DB query)، ويحتاج موافقة المخطط على الـ architectural shift.

**الـ Fix المقترح للمبرمج (للـ stage التالي):**
```ts
async ensureProjectAccess(user: JwtPayload, projectId: string): Promise<void> {
  // Tenant + soft-delete gate FOR ALL roles, including admins.
  // Before: admins bypassed the lookup → cross-tenant access (CVE-PROJ-001).
  const project = await this.prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId, ...this.prisma.softDeleteFilter },
    select: { id: true, clientId: true },
  });
  if (!project) throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المشروع');

  if (['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)) return;

  if (user.role === 'CLIENT') {
    if (project.clientId !== user.userId) {
      throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المشروع');
    }
    return;
  }

  // Other roles — must be assigned (existing logic، الـ project check above already
  // confirmed companyId + not-deleted، فالـ assignment الآن transitively tenant-safe).
  const assignment = await this.prisma.projectAssignment.findFirst({
    where: { projectId, userId: user.userId, removedAt: null },
  });
  if (!assignment) throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المشروع');
}
```

هذا الـ fix يقفل CVE-PROJ-001 (companyId) و A2 (deletedAt) في move واحد.

- **الحالة:** ⚠️ **NEEDS-CODER**

---

## ثغرات أخرى مكتشفة (non-blocking)

### [CHAT-FOLLOWUP-001] `chat.findRooms` و `chat.createRoom` بدون defense-in-depth

- **الخطورة:** 🟠 HIGH (downstream consumer من CVE-PROJ-001)
- **الموقع:** `apps/api/src/modules/chat/chat.service.ts:26-44` (findRooms) و `chat.service.ts:64-109` (createRoom)
- **الـ Root Cause:** الـ 2 methods يـ trust `ensureProjectAccess` بشكل أعمى، بينما باقي 4 modules أضافوا defense-in-depth tenant gate.
- **الـ Status:** ⚠️ **OUT-OF-SCOPE FOLLOWUP** — حتى لو CVE-PROJ-001 اتفكّ في الـ projects module، الـ `chat.findRooms` لازم يضيف `project: { companyId: user.companyId, deletedAt: null }` في الـ where clause لـ defense-in-depth ضد regressions مستقبلية. أيضاً `createRoom` لازم يفحص الـ projectId صراحة لإنه `data.projectId: projectId` بدون companyId implicit. **توصية:** session 1.8 — chat module hardening.
- **Note:** لا تـ open الآن لأن chat module خارج scope صراحة. لكن لـ المراجع الأعلى: لو CVE-PROJ-001 اتفكّ بالـ source-fix، الـ chat exposure يـ effectively closed لكن الـ defense-in-depth gap لسه موجود.

### [PROJ-NOTE-001] `update` audit `newValues: dto` ينقل DTO كامل
- **الخطورة:** 🟢 LOW (informational)
- **الموقع:** `projects.service.ts:234` و `phases.service.ts:219`
- **الـ Analysis:** الـ `newValues: dto as Record<string, unknown>` بيـ persist كل الـ optional fields حتى لو undefined. ValidationPipe `whitelist: true + forbidNonWhitelisted: true` بيـ strip أي extra keys، فالـ contents آمنة. لكن لو في field فاضي تـ written كـ `undefined` للـ audit log — noise. لا exploit. **الحالة:** observation للـ session 1.8 لو في cleanup.

### [PROJ-NOTE-002] `assignMember` orphan data بعد F1
- **الخطورة:** 🟢 LOW (data integrity، not security)
- **الـ Analysis:** لو فيه ProjectAssignment رجود قديم بـ User.role IN ('CLIENT', 'PROJECT_MANAGER', 'SUPER_ADMIN') من قبل F1، الـ F1 fix بيمنع *new* assignments لكن لا يـ clean الـ existing data. الـ assignments العالقة:
  - مش هتـ reactivated (F1 يرفض).
  - **هتظل ظاهرة في `findAll`** على الـ project لـ `assignments.where({ removedAt: null })` queries — تـ pollute الـ visibility filter.
- **الحالة:** يحتاج one-time data audit في session 1.8: `SELECT * FROM project_assignment pa JOIN user u ON pa.user_id = u.id WHERE u.role NOT IN ('SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER') AND pa.removed_at IS NULL`. لو لقي records → cleanup migration بـ `removedAt` set.

### [PROJ-NOTE-003] `recalculateProgressInTx` لسه يقبل `PrismaService` overload (A1 from architect)
- **الخطورة:** 🟢 LOW (dormant)
- **الـ Analysis:** بعد F3، الـ method signature لسه `tx: Prisma.TransactionClient | PrismaService`. لو developer جديد كتب `this.projectsService.recalculateProgressInTx(this.prisma, projectId)` بعد commit، الـ C28 violation يرجع. كل الـ callers الحاليين بـ tx فعلاً — exploit dormant. **الحالة:** سيشن 1.8 — tighten signature.

---

## Attack Vectors التي تم فحصها ولم تجد ثغرات

| Hypothesis (من scope/architect) | الفحص | النتيجة |
|---|---|---|
| #1 RBAC bypass في `findAll` (role=undefined) | JwtStrategy يقرأ user من DB بـ `role` enum مطلوبة. لا path لـ `role=undefined` في JwtPayload في production. لو role enum value جديدة دخلت بدون code update → الـ user يـ fall into "assignment-based" branch (restrictive، not permissive). | ✅ غير قابل للاستغلال |
| #2 Tenant cross-leak في `assignMember` | `getOwnedProject(user.companyId, projectId)` + `findFirst({ where: { id, companyId, role: { in: staff } } })` — كلاهما tenant-gated. | ✅ مغلق |
| #3 State-machine bypass via `update()` mass-assigning `status` | `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` يرفض أي extra field. `UpdateProjectDto` لا يحتوي على `status`. الـ explicit data dict في `update()` لا يقبل `status`. | ✅ مغلق (defense-in-depth ×2) |
| #4 Phase-via-deleted-project | F2 (المرحلة الحالية) قفلت `findAll` و `findOne`. كل الـ phase mutations بتعبر عبر `findOne` → transitively protected. | ✅ مغلق |
| #5 Progress overflow / weight=0 | `Math.min(100, Math.round(weighted / totalWeight))` + early-return لـ `totalWeight === 0` و `phases.length === 0`. لا NaN، لا overflow. | ✅ آمن |
| #6 Reorder collision | Q4 deferred في Plan. غير في الـ scope الحالي. | ⏸️ deferred (مش CVE) |
| #7 `recalculateProgress` (public) outside tx | F3 (المرحلة الحالية) حذفت الـ wrapper. grep verification: صفر callers. | ✅ مغلق |
| #8 Mass assignment via `update()` + audit `newValues: dto` | ValidationPipe forbidNonWhitelisted يرفض extra fields قبل ما يوصل لـ service. الـ audit يحفظ DTO آمنة. AuditLogService.sanitize يستثني SENSITIVE_KEYS. | ✅ آمن (PROJ-NOTE-001 informational) |
| #9 CANCELLED → DELETE audit mapping | `AuditLogService.assertEntryValid` (audit-log.service.ts:233-245) يـ enforce `reason ≥20` لـ DELETE defense-in-depth. service-layer `NEGATIVE_TRANSITIONS` check يـ duplicate الحماية. | ✅ آمن (paired-assertion target للمختبر) |
| #10 Phase soft-delete: active-updates guard | `UpdateStatus` enum schema verification: ['DRAFT', 'PENDING', 'APPROVED'] active set صحيح، يستثني REJECTED + FORCE_CANCELLED. | ✅ آمن |
| A1 (PrismaService overload — architect post-exec) | dormant — لا active caller يـ misuse. **PROJ-NOTE-003** للـ backlog. | 🟢 LOW non-blocking |
| A2 (ensureProjectAccess deletedAt — architect post-exec) | **مدموج في CVE-PROJ-001 fix** — الـ fix المقترح يقفل كلاهما. | ⚠️ NEEDS-CODER (مع CVE-PROJ-001) |

---

## ملخص الإصلاحات

- **CRITICAL:** 1 لقى → اتصلح: 0 (NEEDS-CODER — لا inline fix).
- **HIGH:** 0 (الـ CHAT-FOLLOWUP-001 downstream من CRITICAL، يـ self-resolve لو CRITICAL اتصلح في الـ source).
- **MEDIUM:** 0.
- **LOW:** 3 (PROJ-NOTE-001/002/003) → اتصلح: 0 (informational فقط، session 1.8 backlog).
- **NEEDS-CODER:** 1 (CVE-PROJ-001) → **الـ session اتوقف للإصلاح.**

---

## ثغرات لسه مفتوحة (مع مبرر)

- **CVE-PROJ-001:** NEEDS-CODER — الـ session يرجع للمبرمج للإصلاح في الـ stage التالي. لا inline fix لأن الـ change architectural (يضيف DB query لكل admin call عبر 5 modules) ويـ touch surface خارج النطاق المحدّد للهاكر mode (attack-and-fix-critical-only).

---

## توصيات للمختبر (Stage 4)

**MVT specs لـ CVE-PROJ-001 بعد ما المبرمج يـ fix:**

1. **`ensureProjectAccess` SUPER_ADMIN cross-tenant** — given user.role=SUPER_ADMIN of Company-A وprojectId of Company-B، expect `ForbiddenException` (paired-assertion على الـ throw، deepest).
2. **`ensureProjectAccess` PROJECT_MANAGER cross-tenant** — مماثل للـ #1 بـ PROJECT_MANAGER role.
3. **`ensureProjectAccess` admin in own company** — given user.role=SUPER_ADMIN + projectId in same company + not deleted، expect resolve (no throw، بـ assertion على رجوع void).
4. **`ensureProjectAccess` deletedAt cascade** — given user.role=SUPER_ADMIN + projectId of own-company-but-deleted، expect `ForbiddenException` (A2 closure).
5. **`ensureProjectAccess` CLIENT non-owner cross-project** — given user.role=CLIENT + projectId not owned by user (even same company)، expect `ForbiddenException`.
6. **`ensureProjectAccess` Engineer without assignment** — given user.role=SITE_ENGINEER + projectId where no assignment exists، expect `ForbiddenException`.

**MVT specs غير متعلقة بـ CVE (من Plan tester budget):**
- نفس الـ scaffold المقترح في 00-plan.md (Projects #1-#8، Phases #1-#7).
- إضافة **`assignMember rejects CLIENT/PROJECT_MANAGER/SUPER_ADMIN`** (F1 paired-assertion).
- إضافة **`phases.findAll excludes phases of soft-deleted projects`** (F2 paired-assertion).
- **`recalculateProgressInTx` regression الـ regression-guard-via-typescript** — لا spec قابل للكتابة (compile-time). تأكيد grep بدلاً منه في tester report.

---

✋ **NEEDS-CODER — الـ session متوقف.**

السبب: CVE-PROJ-001 (CRITICAL، cross-tenant data leak via `ensureProjectAccess` admin bypass) يحتاج architectural fix في الـ projects module المبرمج لازم يطبّق الـ fix المقترح أعلاه (الذي يقفل أيضاً A2 من architect post-exec) قبل الانتقال للمختبر. الـ session يرجع للـ stage 2 (المبرمج) لاستئناف العمل على Stage 2 جديد.

✋ تم الهاكر — للدور التالي؟ (المبرمج لـ NEEDS-CODER fix، ثم المخطط post-exec للـ stage الجديد، ثم نرجع للمختبر).
