# 📕 الملف 4 — Chat + Audit + Sub-Contractors + Health

> الجزء الرابع. بيغطي الموديولات المتبقية: الشات، سجل المراجعة (الـ controller + تفاصيل الـ service الكاملة)، مقاولي الباطن، والـ health checks.

---

═══════════════════════════════════════════════════════════════

## 🗨️ القسم 1: موديول Chat (الشات)

### 1. الغرض
شات داخل المشروع — غرف (DIRECT/GROUP) فيها رسائل بين أعضاء الفريق. **حالياً REST-based** (الـ WebSocket في Phase 3 حسب التعليق). بيدعم: غرف، رسائل (paginated)، وحالة القراءة (read receipts).

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `chat.module.ts` | 16 | يستورد AuditModule + ProjectsModule. |
| `chat.controller.ts` | 73 | 5 endpoints. |
| `chat.service.ts` | 224 | المنطق. |
| `dto/index.ts` | 50 | CreateChatRoomDto + SendMessageDto + ListMessagesQueryDto. |

### 3. الـ Endpoints بالتفصيل

#### 🔹 `GET /api/v1/projects/:projectId/chat-rooms` (findRooms)
- **كل الأدوار** (`ensureProjectAccess` بيفحص).
- **المنطق:** admin/PM → كل غرف المشروع؛ باقي الأدوار → بس الغرف اللي هم participants فيها (`participants.some({ userId })`).
- **defense-in-depth (CHAT-FOLLOWUP-001):** حتى بعد `ensureProjectAccess`، الـ query نفسه بيعيد التأكيد إن المشروع في شركة المستخدم (`projectGuard = { companyId, deletedAt: null }`) — لو refactor مستقبلي ضعّف الـ gate الأعلى، الغرف تفضل معزولة على مستوى الـ DB. بيرجّع الغرف مع `_count` للرسائل والمشاركين.

#### 🔹 `POST /api/v1/projects/:projectId/chat-rooms` (createRoom)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `CreateChatRoomDto` — `name` (2–200)، `type?` (DIRECT/GROUP، default GROUP)، `participantIds?` (array UUIDs).
- **المنطق:** create الغرفة، **المنشئ دايماً participant** (بيتضاف لو مش في القائمة)، `createMany` للمشاركين بـ `skipDuplicates`، + audit (best-effort).

#### 🔹 `GET /api/v1/chat-rooms/:roomId/messages` (getMessages)
- **كل الأدوار** (`getRoomWithAccess`). **DTO:** `ListMessagesQueryDto` (pagination، default limit 50). بيرجّع الرسائل غير المحذوفة paginated.

#### 🔹 `POST /api/v1/chat-rooms/:roomId/messages` (sendMessage)
- **كل الأدوار** (`getRoomWithAccess`). **DTO:** `SendMessageDto` — `content` (1–5000)، `type?` (TEXT/IMAGE/FILE/VOICE، default TEXT)، `attachmentUrl?`.
- create رسالة. **ملاحظة: مفيش audit هنا** (الرسائل عالية التردد).

#### 🔹 `POST /api/v1/chat-rooms/:roomId/read` (markAsRead)
- **كل الأدوار.** بيحدّث `lastReadAt` للمشارك + بيعلّم كل الرسائل اللي **مش** من المستخدم نفسه كـ `isRead: true`.

### 4. الـ Business Logic
- **الرؤية المبنية على المشاركة:** غير الـ admins بيشوفوا غرفهم بس.
- **read receipts:** lastReadAt على الـ participant + isRead على الرسائل (الواردة فقط).
- **مفيش audit على الرسائل** (best-effort audit على إنشاء الغرفة بس).

### 5. القرارات الأمنية
- **`getRoomWithAccess`:** يتأكد الغرفة في الشركة (404 لو لأ) + `ensureProjectAccess`.
- **Tenant isolation مزدوج** (CHAT-FOLLOWUP-001) — على مستوى الـ gate والـ query.
- **رؤية بالمشاركة** لغير الـ admins.

---

═══════════════════════════════════════════════════════════════

## 🔍 القسم 2: موديول Audit (سجل المراجعة)

### 1. الغرض
سجل **append-only** (إضافة فقط) لكل العمليات الحساسة في النظام — مين عمل إيه ومتى وعلى إيه. ده عمود فقري للامتثال (compliance) والتحقيق الجنائي (forensics). الموديول بيتكوّن من جزئين: **`AuditLogService`** (الكتابة — مستخدم في كل الموديولات) و **`AuditController`** (القراءة — SUPER_ADMIN فقط).

> الـ `AuditLogService` اتشرح بالتفصيل في الملف 1 (لأنه dependency لكل حاجة)، لكن هنا التفاصيل الكاملة.

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `audit.module.ts` | 13 | يصدّر `AuditLogService` (بيتستورد في كل موديول تقريباً). |
| `audit.controller.ts` | 65 | endpoint واحد للقراءة. |
| `audit-log.service.ts` | 303 | منطق الكتابة (مسارين) + sanitization. |

### 3. الـ Endpoint

#### 🔹 `GET /api/v1/audit-logs` (findAll)
- **الأدوار:** `SUPER_ADMIN` فقط.
- **Query:** `PaginationDto` + فلاتر اختيارية: `entityType`, `action`, `userId`, `from`, `to` (تواريخ).
- **المنطق:** `where = { companyId }` + الفلاتر؛ لو فيه `from`/`to` → فلتر على `createdAt` (gte/lte). بيرجّع السجلات مع بيانات اللي عمل العملية، مرتبة تنازلياً، paginated.
- **ملاحظة:** الـ controller ده بيستخدم `PrismaService` مباشرة (مش بيعدي على service)، وده استثناء بسيط.

### 4. الـ Business Logic المعقّد — `AuditLogService` (مسارين للكتابة)

**المسار 1: `logInTransaction(tx, entry)` — للعمليات الحرجة:**
- بيكتب جوه الـ transaction بتاع المنادي.
- **لو فشل → بيرمي خطأ → الـ transaction كله يترجع.**
- المبدأ (skill 07): "If it didn't get audited, it didn't happen." للعمليات المالية، فشل الـ audit **لازم** يرجّع العملية.
- مستخدم في: payments, updates, projects, phases, users, companies.

**المسار 2: `log(entry)` — best-effort:**
- بيكتب برّه أي transaction. **لو فشل → بيسجّل error بس مايرميش.**
- للأحداث غير الحرجة: قراءة حسّاسة، export، أحداث chat/comments/subcontractors.
- المقايضة مقبولة: الخسارة "مش عارفين مين شاف X"، مش "ضيّعنا X".

**التحقق (`assertEntryValid`):**
- الحقول الإجبارية: companyId, userId, userRole, entityType, entityId, action.
- `entityType` لازم يكون lowercase snake_case (`^[a-z][a-z_]*$`).
- **reason إجباري (≥20 حرف) للعمليات السلبية:** `DELETE`, `REJECT`, `FORCE_CANCEL`, `PROGRESS_OVERRIDE`.

**Sanitization (`sanitize`):**
- بيشيل أي مفتاح قيمته سرّية قبل التخزين (recursive للكائنات المتداخلة).
- `SENSITIVE_KEYS` = password, token, accesstoken, refreshtoken, secret, apikey, authorization, cookie, creditcard, cardnumber, cvv, ssn, pin.
- أي مفتاح بيحتوي على واحد منهم (case-insensitive، substring) → قيمته بتتحول لـ `[REDACTED]`.

**بيانات إضافية في كل سجل (`buildData`):**
- `requestId` من `RequestContext` (للربط مع access log).
- `ipAddress` (من X-Forwarded-For أول IP، أو req.ip، مقصوص لـ 45 حرف).
- `userAgent` (مقصوص لـ 500 حرف).
- `oldValues`/`newValues` → `Prisma.DbNull` لو null.

### 5. القرارات الأمنية
- **Append-only** — مفيش update/delete على السجلات (محمي كمان بـ DB migration `audit_immutability` — راجع الملف 5).
- **مسار transactional للعمليات المالية** — atomicity مع العملية.
- **Sanitization للأسرار.**
- **reason إجباري للعمليات السلبية.**
- **القراءة لـ SUPER_ADMIN فقط** + tenant isolation (`companyId`).
- **userRole snapshot** — بيتخزّن كـ string وقت العملية، عشان لو الدور اتغير بعدين، السجل التاريخي يفضل صحيح.

---

═══════════════════════════════════════════════════════════════

## 🏗️ القسم 3: موديول Sub-Contractors (مقاولي الباطن)

### 1. الغرض
إدارة مقاولي الباطن على مستوى الشركة + ربطهم بمراحل المشاريع. مقاول الباطن كيان على مستوى الشركة (مش المشروع)، بيتعيّن على مراحل محددة بعقد (agreedCost/actualCost) وحالة.

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `sub-contractors.module.ts` | 16 | يستورد AuditModule + ProjectsModule. |
| `sub-contractors.controller.ts` | 113 | 7 endpoints. |
| `sub-contractors.service.ts` | 276 | المنطق. |
| `dto/index.ts` | 95 | 4 DTOs. |

### 3. الـ Endpoints بالتفصيل

#### 🔹 `GET /api/v1/sub-contractors` (findAll)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`, `ACCOUNTANT`. كل مقاولي الشركة (غير المحذوفين) + `_count` للمراحل.

#### 🔹 `GET /api/v1/sub-contractors/:id` (findOne)
- نفس الأدوار. المقاول + كل تعييناته على المراحل (مع تفاصيل المرحلة والمشروع). 404 لو مش في الشركة.

#### 🔹 `POST /api/v1/sub-contractors` (create)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `CreateSubContractorDto` — `name` (≤300)، `specialty` (≤500)، `phone` (regex، مطلوب)، `email?`، `notes?` (≤2000). create + audit (best-effort).

#### 🔹 `PATCH /api/v1/sub-contractors/:id` (update)
- نفس الأدوار. **DTO:** `UpdateSubContractorDto` (كله اختياري). update + audit.

#### 🔹 `GET /api/v1/phases/:phaseId/sub-contractors` (findByPhase)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`, `ACCOUNTANT`. تعيينات المرحلة مع بيانات المقاول. 404 لو المرحلة مش في الشركة.

#### 🔹 `POST /api/v1/phases/:phaseId/sub-contractors` (assignToPhase)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `AssignToPhaseDto` — `subContractorId` (UUID)، `agreedCost?` (≥0).
- **المنطق:** تحقق وصول المرحلة + `ensureProjectAccess`، تحقق المقاول في نفس الشركة، لو معيّن بالفعل → `409`. transaction: create التعيين + **زيادة `totalProjects` للمقاول بـ 1**. + audit.

#### 🔹 `PATCH /api/v1/phase-assignments/:id` (updateAssignment)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `UpdatePhaseAssignmentDto` — `agreedCost?`, `actualCost?`, `status?` (ACTIVE/COMPLETED/TERMINATED). update + audit.

#### 🔹 `DELETE /api/v1/sub-contractors/:id` (softDelete)
- **الأدوار:** `SUPER_ADMIN` فقط. soft-delete (`deletedAt`) + audit (best-effort).

### 4. الـ Business Logic
- **مقاول على مستوى الشركة، تعيين على مستوى المرحلة:** نفس المقاول ممكن يتعيّن على مراحل كتير في مشاريع مختلفة.
- **`totalProjects` counter:** بيتزوّد تلقائياً عند كل تعيين على مرحلة.
- **عقد لكل تعيين:** agreedCost (متفق) vs actualCost (فعلي) + حالة العقد.

### 5. القرارات الأمنية
- **Tenant isolation** على كل query (`companyId`).
- **`ensureProjectAccess`** عند التعيين على مرحلة.
- **منع التعيين المكرر** (409).
- **audit best-effort** (الموديول مش financial-critical بنفس درجة payments/updates).

---

═══════════════════════════════════════════════════════════════

## ❤️ القسم 4: موديول Health (فحوصات الصحة)

### 1. الغرض
endpoints لمراقبة صحة التطبيق — للـ load balancer / Kubernetes. مقسّمة لـ liveness (هل الـ process شغّال؟) و readiness (هل كل الـ dependencies شغّالة؟).

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `health.module.ts` | 7 | controller بس، مفيش service. |
| `health.controller.ts` | 189 | 2 endpoints + per-dependency checks. |

> ملاحظة: الـ health مثبّت على `/health` (مش تحت `api/v1` — متاستثنى في main.ts) عشان probes تلاقي URL ثابت.

### 3. الـ Endpoints بالتفصيل

#### 🔹 `GET /health` (liveness)
- **`@Public()`** + HTTP 200. **رخيص جداً** — بيرجّع 200 طول ما الـ event loop مش متعلّق. **مش** بيفحص أي dependency (عشان hiccup مؤقت في DB ما يقتلش الـ pod). بيرجّع `{ status: 'ok', uptime, timestamp }`.

#### 🔹 `GET /health/ready` (readiness)
- **`@Public()`.** بيفحص كل الـ dependencies بالتوازي:
  - **`checkDatabase`:** `SELECT 1` بـ `$queryRaw` (يمارس الـ driver الفعلي) مع timeout 2 ثانية.
  - **`checkSupabase`:** `fetch` لـ `/auth/v1/health` مع AbortController timeout 2 ثانية. (404 = "Supabase ردّ" = مقبول؛ network error = down).
- لو أي dependency مش `ok` → بيرمي `503 SERVICE_UNAVAILABLE` (الـ LB يشيله من الـ rotation). الـ body فيه حالة كل dependency (status, latencyMs, message) من غير تسريب تفاصيل داخلية.

### 4. الـ Business Logic
- **liveness vs readiness:** liveness بيقول "أنا حي" (مايفحصش dependencies)، readiness بيقول "أنا جاهز أستقبل traffic" (يفحص كل حاجة).
- **timeouts ضيقة (2 ثانية):** عشان Supabase بطيء مايعلّقش الـ probe (اللي هيسبب alerts متتالية).
- **`withTimeout` helper:** بيعمل race بين الـ promise والـ timeout.

### 5. القرارات الأمنية
- **public بس rate-limited** (default profile).
- **مفيش تسريب تفاصيل** — بس status string لكل dependency.

---

## 📎 ملاحظة: ملفات غير مستخدمة
- `src/app.controller.ts` + `src/app.service.ts` — موجودين (Hello World) لكن **مش مسجّلين** في `app.module.ts` (الـ controllers/providers بتوعهم مش في الـ module). يعني dead code من الـ NestJS starter.

➡️ التالي: **الملف 5** — Database Schema الكامل + Cross-cutting infrastructure + كل الـ Enums.
