# 📙 الملف 3 — Payments + Media + Comments

> الجزء الثالث. بيغطي الموديولات المرتبطة بالتحديثات والمشاريع: المدفوعات (مالية حسّاسة)، الوسائط (أمان رفع الملفات)، والتعليقات (نقاش مترابط).

---

═══════════════════════════════════════════════════════════════

## 💰 القسم 1: موديول Payments (المدفوعات)

### 1. الغرض
تسجيل وإدارة الحركات المالية للمشروع: دفعات العميل، المصروفات، والتكاليف الغارقة. + ملخص مالي للمشروع (دخل/مصروف/ربح/متبقي من الميزانية). ده موديول **مالي حسّاس**، فكل القواعد المالية مطبّقة بصرامة: soft-delete بس، حساب بـ Decimal (مش float)، idempotency، وaudit إجباري.

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `payments.module.ts` | 16 | يستورد AuditModule + ProjectsModule. |
| `payments.controller.ts` | 106 | 5 endpoints. |
| `payments.service.ts` | 387 | المنطق المالي كله. |
| `dto/index.ts` | 76 | CreatePaymentDto + DeletePaymentDto + ListPaymentsQueryDto. |

**ثوابت:** `PAYMENT_SELECT` (projection آمن مع بيانات الـ recorder)، `MAX_PAGE_SIZE = 100`.

### 3. الـ Endpoints بالتفصيل

#### 🔹 `GET /api/v1/projects/:projectId/payments` (findAll)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`, `ACCOUNTANT`.
- **DTO:** `ListPaymentsQueryDto` — pagination + `type?` (enum) + `method?` (enum).
- **المنطق:** `ensureProjectAccess` (Layer 3) ثم query بـ `projectId + companyId + deletedAt: null` (defense-in-depth). بيرجّع `{ items, total, page, limit, totalPages }`.

#### 🔹 `GET /api/v1/projects/:projectId/payments/summary` (getSummary)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`, `ACCOUNTANT`, **`CLIENT`** (العميل يقدر يشوف الملخص المالي لمشروعه).
- **المنطق:** `groupBy type` مع `_sum.amount`. كل الحساب بـ **`Decimal`** (ممنوع `Number()`):
  - `totalIncome` = مجموع الـ CLIENT_PAYMENT.
  - `totalExpenses` = مجموع كل الأنواع التانية (EXPENSE + SUNK_COST).
  - `netProfit` = totalIncome − totalExpenses.
  - `remainingBudget` = budget − totalExpenses.
- بيرجّع كل القيم كـ **strings** (`toFixed(2)`) عشان الـ precision تتحفظ عبر JSON. الـ frontend لازم يستخدم Decimal library مش JS Number.

#### 🔹 `GET /api/v1/payments/:id` (findOne)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`, `ACCOUNTANT`, `CLIENT`. query بـ companyId + soft-delete، ثم `ensureProjectAccess`.

#### 🔹 `POST /api/v1/projects/:projectId/payments` (create) — idempotent
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`, `ACCOUNTANT`. **لازم `Idempotency-Key` header.**
- **DTO:** `CreatePaymentDto`:
  | الحقل | القواعد |
  |------|---------|
  | `amount` | رقم، بحد أقصى منزلتين عشريتين، 0.01–999,999,999.99 |
  | `type` | enum `PaymentType` (CLIENT_PAYMENT/EXPENSE/SUNK_COST) |
  | `method` | enum `PaymentMethod` (CASH/BANK_TRANSFER/CHECK/OTHER) |
  | `description` | اختياري، ≤1000 |
  | `referenceNumber` | اختياري، ≤200 (ملاحظة: مش بيتخزّن في الـ service الحالي) |
  | `receiptUrl` | اختياري، ≤500 |
  | `date` | ISO date اختياري (default = الآن) |
- **خطوة بخطوة:**
  1. **Idempotency lookup** بـ fingerprint = `{projectId, ...dto}`. لو موجود → الـ cached body.
  2. `ensureProjectAccess` + التأكد إن المشروع موجود.
  3. **لو المشروع `CANCELLED` → `400 "لا يمكن تسجيل مدفوعات على مشروع ملغى"`.**
  4. **`runSerializable`:** `payment.create` (amount كـ Decimal) + audit (`CREATE`) + normalize body (amount→string, date→ISO) + **`saveInTransaction`** للـ idempotency record.
- **مثال request:**
```
POST /api/v1/projects/<id>/payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
{ "amount": 150000.00, "type": "CLIENT_PAYMENT", "method": "BANK_TRANSFER", "description": "الدفعة الأولى" }
```
- **مثال response:** `{ "success": true, "data": { "id": "...", "amount": "150000.00", "type": "CLIENT_PAYMENT", "date": "2026-06-22T...", ... } }`
- **الأخطاء:** `404` (مشروع)، `400` (ملغى)، `422` (idempotency key بنفسه وبيانات مختلفة).

#### 🔹 `DELETE /api/v1/payments/:id` (softDelete)
- **الأدوار:** `SUPER_ADMIN` فقط. HTTP 200. **DTO:** `DeletePaymentDto` — `reason` (20–2000، إجباري).
- **soft-delete فقط — `prisma.payment.delete()` ما بيتندهش أبداً.** بيحط `deletedAt`, `deletedBy`, `deletionReason` + audit (`DELETE`) في **Serializable transaction**. لو محذوف بالفعل → `400`.

### 4. الـ Business Logic المعقّد

**مثال رقمي للـ summary:**
مشروع ميزانيته 1,000,000، عليه:
- CLIENT_PAYMENT: 300,000 + 200,000 = **500,000** (دخل)
- EXPENSE: 150,000
- SUNK_COST: 50,000 (من تحديث ملغي)

→ `totalIncome = 500,000` | `totalExpenses = 200,000` | `netProfit = 300,000` | `remainingBudget = 1,000,000 − 200,000 = 800,000`.

كل ده محسوب بـ Decimal — لو اتحسب بـ float ممكن يطلع `799999.9999999` بدل 800,000.

**ليه soft-delete إجباري؟** (من تعليقات الكود):
- التزام ضريبي: احتفاظ 7 سنين (القانون التجاري المصري).
- الدفاع في النزاعات: السجل لازم يفضل دليل.
- محاسبة العكس: الدفعة المحذوفة hard بتسيب فجوة في المجاميع؛ الـ soft-deleted لسه قابلة للاستعلام في إعادة البناء الجنائي.

### 5. القرارات الأمنية
- **Idempotency (PAY-IDEM-001):** double-click على "حفظ" في نت بطيء = دفعتين متطابقتين = العميل اتحاسب مرتين. الـ Idempotency-Key بيمنع ده. والـ `saveInTransaction` بيقفل نفس race بتاع CVE-UPD-002 على endpoint مالي (الـ save القديم كان بعد الـ commit).
- **Decimal-only arithmetic** — دقة مالية.
- **Soft-delete only** — حماية قانونية.
- **Audit جوه transaction** — لو الـ audit فشل، العملية المالية تترجع.
- **منع الدفع على مشروع ملغى.**
- **Tenant isolation** + `ensureProjectAccess` على كل endpoint.

---

═══════════════════════════════════════════════════════════════

## 📸 القسم 2: موديول Media (الوسائط)

### 1. الغرض
إدارة رفع الملفات (صور/فيديو/مستندات) المرتبطة بالتحديثات. التصميم آمن جداً: الرفع بيتم **مباشرة من العميل لـ Supabase Storage** عن طريق signed URL، والـ backend بيتحقق من الملف **بعد** الرفع (magic bytes + الحجم الحقيقي) قبل ما يسجّله في DB. القراءة بتتم عن طريق signed URLs قصيرة العمر بس.

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `media.module.ts` | 18 | يستورد AuditModule + ProjectsModule + CompaniesModule. |
| `media.controller.ts` | 134 | 5 endpoints. |
| `media.service.ts` | 356 | منطق الـ workflow (issue URL → register → read → delete). |
| `media-security.service.ts` | 325 | **طبقة الأمان** — كل التعامل مع Supabase Storage + التحقق. |
| `media-security.constants.ts` | 107 | السياسات: mimes/extensions/sizes/buckets + deny-list. |
| `dto/index.ts` | 84 | CreateUploadUrlDto + CreateMediaDto + DeleteMediaDto + ReorderMediaDto. |

**ثوابت:** `MAX_MEDIA_PER_UPDATE = 20`, `MEDIA_SELECT` (projection آمن).

### 3. الـ Workflow (4 خطوات — مهم تفهمها)
```
1. POST /media/upload-url   → السيرفر يعمل signed upload URL + path (companyId/userId/uuid.ext)
2. الكلاينت يرفع الملف مباشرة لـ Supabase بالـ URL
3. POST /updates/:uid/media → السيرفر يتحقق (HEAD حجم + magic bytes) ثم يسجّل Media row
4. GET  /media/:id/signed-url → السيرفر يرجّع read URL قصير العمر
```

### 4. الـ Endpoints بالتفصيل

#### 🔹 `POST /api/v1/media/upload-url` (createUploadUrl)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`, `SITE_ENGINEER`, `SUPERVISOR`, `WORKER` (مش CLIENT/ACCOUNTANT).
- **DTO:** `CreateUploadUrlDto` — `type` (enum MediaType: IMAGE/VIDEO/DOCUMENT).
- **المنطق:** `security.createSignedUploadUrl` → بيولّد path `{companyId}/{userId}/{uuid}.{ext}`، يختار الـ bucket من السياسة (مش من العميل)، يطلب من Supabase signed upload URL. بيرجّع `{ bucket, path, signedUrl, token, maxSize, allowedMimes }`.

#### 🔹 `POST /api/v1/updates/:updateId/media` (addToUpdate)
- **الأدوار:** نفس الخمسة. **DTO:** `CreateMediaDto`:
  | الحقل | القواعد |
  |------|---------|
  | `path` | string مطلوب، ≤500، regex `^[a-f0-9-]+\/[a-f0-9-]+\/[A-Za-z0-9._-]+$` |
  | `type` | enum MediaType |
  | `caption` | اختياري، ≤300 |
  | `order` | اختياري، int ≥0 |
- **ملاحظة مهمة:** الـ `fileSize` و `mimeType` **مش** بيتقبلوا من العميل — بيتم اشتقاقهم من الملف نفسه.
- **خطوة بخطوة:**
  1. `assertPathBelongsToTenant` — الـ path لازم يبدأ بـ `{companyId}/` (آخر خط دفاع ضد tenant آخر).
  2. التحقق إن الـ update موجود وفي نفس الشركة (وإلا 404).
  3. لازم تكون الـ submitter أو admin/PM (وإلا 403).
  4. لو وصل `MAX_MEDIA_PER_UPDATE` (20) → `400`.
  5. **`verifyUploadedFile`** (التفاصيل تحت): HEAD للحجم الحقيقي + magic bytes + فحص mime. لو فشل (مش NotFound) → **يمسح الـ orphan** من Storage ثم يرمي الخطأ.
  6. **Quota gate** بالحجم **المتحقّق منه** (`assertCanUseStorage`) — العميل ما يقدرش يكذب.
  7. transaction: `media.create` (url = path، fileSize/mime من المتحقّق) + **زيادة `company.storageUsed`** بالحجم + audit.

#### 🔹 `GET /api/v1/updates/:updateId/media` (findByUpdate)
- **الأدوار:** الكل (7 أدوار). بيتأكد من رؤية الـ update، وللـ CLIENT: لازم يكون صاحب المشروع والـ update يكون APPROVED. بيرجّع كل الـ media غير المحذوفة مرتبة بالـ order.

#### 🔹 `GET /api/v1/media/:id/signed-url` (getSignedReadUrl)
- **الأدوار:** الكل. نفس فحوصات الرؤية، ثم `createSignedReadUrl` بـ TTL حسب النوع (15 دقيقة للمستندات، ساعة للصور/الفيديو). مسارات الرفض بترجّع 404 موحّد.

#### 🔹 `DELETE /api/v1/media/:id` (softDelete)
- **الأدوار:** الخمسة (مش CLIENT/ACCOUNTANT). **DTO:** `DeleteMediaDto` — `reason` (20–2000).
- soft-delete (الملف في Storage **بيتحفظ** كدليل قانوني) + audit. لازم تكون الـ submitter أو admin. **ملاحظة:** الحذف ما بيرجّعش الـ `storageUsed` (حسب الـ PLAN، cron مستقبلي بيأرشف ويفرّغ الكوتا بعد فترة الاحتفاظ).

### 5. الـ Business Logic المعقّد — `verifyUploadedFile` (قلب الأمان)
بيتحقق من ملف ادّعى العميل إنه رفعه، بالخطوات:
1. **HEAD** على الملف → يتأكد إنه موجود + يقرا الحجم الحقيقي (Content-Length). لو 404/400 → NotFound.
2. لو الحجم > `policy.maxSize` → `400` (الحد وقت الرفع ممكن يكون متساهل).
3. **Range GET** لأول 4100 byte (`MAGIC_BYTES_SAMPLE_SIZE`).
4. **`file-type` detection** — يكتشف الـ mime من الـ **magic bytes** مش من header العميل.
5. لو الـ mime في `ALWAYS_BLOCKED_MIMES` → `400` (الـ deny-list قبل الـ allow-list عشان الـ audit يبقى واضح).
6. لو الـ mime مش في `MEDIA_TYPE_POLICY[type].mimes` → `400`.

بيرجّع `VerifiedFile { bucket, path, mime, size, extension }` — كلها server-derived.

**سياسة الأنواع (`MEDIA_TYPE_POLICY`):**
| النوع | الـ mimes المسموحة | الحجم الأقصى | الـ bucket |
|------|------------------|:-----------:|-----------|
| IMAGE | jpeg, png, webp, heic, heif | 10 MB | updates-media |
| VIDEO | mp4, quicktime, webm | 100 MB | updates-media |
| DOCUMENT | pdf فقط | 25 MB | updates-media |

**الـ deny-list (`ALWAYS_BLOCKED_MIMES`):** executables (x-msdownload, x-executable...)، scripts (svg+xml, html, javascript)، archives (zip, rar, 7z, tar, gzip). كلها ممنوعة حتى لو اتحطّت بالغلط في upload صورة.

### 6. القرارات الأمنية (نموذج التهديد من تعليقات الكود)
| التهديد | الدفاع |
|--------|-------|
| رفع .exe باسم .jpg | magic-byte check |
| الكذب في fileSize/mimeType | إعادة الاشتقاق server-side |
| الكتابة في `../../prod-secrets` | path scoping + UUID + رفض `..` و `/` و `\` |
| اختيار الـ bucket من العميل | الـ bucket من السياسة |
| path تحت tenant آخر | `assertPathBelongsToTenant` |
| رفع وعدم تسجيل (orphan) | `deleteOrphan` cleanup |
| مشاركة public read URL | private buckets + signed URL قصير العمر |
| الكوتا | gate بالحجم المتحقّق منه فقط |

> ملاحظة: `MediaSecurityService` بيبني Supabase client خاص بيه (مش الـ global `SUPABASE_ADMIN_CLIENT`) — عشان يقدر يتكلم مع Storage بالـ service-role key مباشرة. مكتوب في تعليق إنه single place عشان يتبدّل بـ S3/R2 أو يتضاف ClamAV لاحقاً.

---

═══════════════════════════════════════════════════════════════

## 💬 القسم 3: موديول Comments (التعليقات)

### 1. الغرض
تعليقات مترابطة (threaded — مستوى واحد من الردود) على التحديثات. 3 أنواع: تعليق عادي (COMMENT)، طلب مراجعة (REVIEW_REQUEST)، طلب تغيير (CHANGE_REQUEST). الأخيرين بيكون ليهم حالة (OPEN/ACKNOWLEDGED/RESOLVED) لتتبّعهم.

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `comments.module.ts` | 16 | يستورد AuditModule + ProjectsModule. |
| `comments.controller.ts` | 76 | 5 endpoints. |
| `comments.service.ts` | 306 | المنطق. |
| `dto/index.ts` | 40 | CreateCommentDto + EditCommentDto + ResolveCommentDto. |

> **ملاحظة مهمة:** الموديول ده بيستخدم `auditLog.log` (best-effort) **مش** `logInTransaction`. السبب: التعليقات مش financial/state-changing بالمعنى الحرج، فلو الـ audit فشل العملية بتكمّل. (راجع الفرق بين المسارين في الملف 4/5.)

### 3. الـ Endpoints بالتفصيل

#### 🔹 `GET /api/v1/updates/:updateId/comments` (findByUpdate)
- **كل الأدوار** (`verifyUpdateAccess` بيفحص). بيرجّع التعليقات الأساسية بس (`parentId: null`) مع الردود (replies) متداخلة، مرتبة بالوقت.

#### 🔹 `POST /api/v1/updates/:updateId/comments` (create)
- **كل الأدوار.** **DTO:** `CreateCommentDto` — `content` (1–5000)، `type?` (enum)، `parentId?` (UUID).
- **المنطق:**
  1. `verifyUpdateAccess`.
  2. لو رد (`parentId`) → لازم الأصل موجود وعلى نفس الـ update و`parentId: null` (مفيش ردود على ردود — مستوى واحد بس).
  3. **`REVIEW_REQUEST`/`CHANGE_REQUEST` مسموحين لـ `SUPER_ADMIN`/`PROJECT_MANAGER` فقط** (وإلا 403).
  4. **الحالة الابتدائية:** COMMENT → `RESOLVED` (مفيش متابعة)؛ الأنواع التانية → `OPEN`.
  5. create + audit (best-effort).

#### 🔹 `PATCH /api/v1/comments/:id` (edit)
- **كل الأدوار.** **DTO:** `EditCommentDto` — `content` (1–5000).
- **`getOwnedComment`** (لازم تكون صاحبه). **نافذة تعديل 30 دقيقة فقط** — بعدها `403`. update + audit.

#### 🔹 `PATCH /api/v1/comments/:id/status` (changeStatus)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`, `SITE_ENGINEER`. **DTO:** `ResolveCommentDto` — `status` (OPEN/ACKNOWLEDGED/RESOLVED).
- لو النوع COMMENT → `400` (الحالة بس لطلبات المراجعة/التغيير). update + audit.

#### 🔹 `DELETE /api/v1/comments/:id` (softDelete)
- **كل الأدوار.** لازم صاحبه أو admin/PM. **بيحذف الردود كمان** (`updateMany` للـ replies + الأصل في transaction واحد). audit (best-effort).

### 4. الـ Business Logic المعقّد
- **Threading بمستوى واحد:** الردود ممكن تكون على top-level comments بس (`parentId: null`). مفيش ردود متداخلة لأكتر من مستوى.
- **State على الطلبات بس:** COMMENT بيبدأ RESOLVED (مفيش حاجة تتابع)، الطلبات تبدأ OPEN وتتنقل لـ ACKNOWLEDGED/RESOLVED.
- **نافذة التعديل 30 دقيقة:** بعد ما تعدي، التعليق ثابت (عشان النقاش يفضل أمين تاريخياً).

### 5. القرارات الأمنية
- **Tenant isolation:** كل query بيتحقق من `companyId` عبر سلسلة `comment → update → phase → project`، والرفض = 404.
- **`ensureProjectAccess`** عن طريق `verifyUpdateAccess`.
- **Ownership على التعديل/الحذف** (`getOwnedComment` / فحص `userId` أو admin).
- **تقييد أنواع التعليقات الإدارية** (REVIEW/CHANGE للمديرين فقط).
- **نافذة تعديل محدودة** — anti-tampering للنقاش.

➡️ التالي: **الملف 4** — Chat, Audit (controller), Sub-Contractors, Health.
