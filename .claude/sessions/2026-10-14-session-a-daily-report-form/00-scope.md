# Scope

## Mode: Standard
السبب: feature جديدة متوسطة (نموذج + مسار بيانات)، الصلاحيات والـ state machine جاهزان ومختبَران بالباك إند بالكامل — الفرونت إند بيستهلك موجود، صفر سطح هجوم جديد (انظر فحص #7أ أسفل). Session A من تقسيم `2026-10-14-core-loop-audit/00-scope.md` (المالك وافق A → B → C).

## المهمة
نموذج "تقرير يومي جديد / متابعة تقرير" لمهندس الموقع/المشرف/العامل، داخل تبويب "المراحل" الموجود فعلاً في صفحة تفاصيل المشروع — بدون صور (تُأجَّل لـ Session B) وبدون لمس الباك إند.

## الملفات المتأثرة

**ملفات تُعدَّل (امتداد لموجود، لا إعادة كتابة):**
- `apps/web/src/lib/api/updates-client.ts` — إضافة `createUpdate` / `editUpdate` / `submitUpdate` (الدوال دي **غير موجودة إطلاقاً** حالياً — مكتوب فيه فقط list/get/approve/reject/forceCancel).
- `apps/web/src/lib/hooks/use-update-actions.ts` — إضافة `useCreateUpdate` / `useEditUpdate` / `useSubmitUpdate` بنفس تحويلات `useInvalidateReview` و`retry:false` القائمة بالفعل لـ approve/reject/forceCancel.
- `apps/web/src/types/update.ts` — إضافة `CreateUpdateBody` / `EditUpdateBody` (نفس أسلوب `RejectUpdateBody`/`ForceCancelBody` الموجودين سطر 188-195؛ **لا يوجد type مشابه الآن**).
- `apps/web/src/app/[locale]/dashboard/projects/[id]/page.tsx` — زرار/شارة جديدة داخل صف كل مرحلة في تبويب "المراحل" الحالي (نفس مكان `PhaseAdminControls` سطر 403-409)، بلا تبويب جديد وبلا route جديد.

**ملف جديد (الوحيد):**
- `apps/web/src/components/dashboard/updates/report-form-dialog.tsx` — الـ Dialog نفسه (فورم الإنشاء/التعديل)، بنفس بنية `update-detail-dialog.tsx` حرفياً (نفس مجلد الموديول).

**ملفات مرجعية فقط (تُقرَأ، لا تُعدَّل):**
`reviews-panel.tsx`, `update-detail-dialog.tsx`, `phase-admin-controls.tsx`, `use-create-project.ts`, `projects/new/page.tsx` (جزئياً)، `updates.controller.ts`, `updates.service.ts`, `dto/index.ts` (الباك إند — قراءة فقط، **صفر تعديل**).

**Service classes:** لا يوجد backend service جديد أو مُعدَّل في هذه الجلسة (قاعدة #6 — n/a، الجلسة frontend بحت).

---

## 🧩 جرد الـ Components (إلزامي قبل أي كود)

### الصفحة المرجعية للشكل والسلوك
بالظبط زي ما طُلب: **`reviews-panel.tsx` + `update-detail-dialog.tsx`** (مش `projects/new/page.tsx`) — لأن الأخيرة wizard تسويقي بستايل مختلف فعلاً عن باقي الداشبورد (`font-black text-xl`, أزرار `rounded-2xl` خضراء كبيرة، `<select>` خام بـ classes يدوية بدل `@/components/ui/select`) — **لو قلّدتها هتبقى شاشة "شكلها مختلف" بالظبط اللي القاعدة بتمنعه.** لذلك:
- **Loading state:** نفس نمط `update-detail-dialog.tsx:205-210` (`Loader2` + نص رمادي صغير، spinner واحد لا skeleton).
- **Error state:** نفس نمط `update-detail-dialog.tsx:212-221` (`AlertTriangle` أحمر + نص توضيحي، لا تفاصيل تقنية).
- **Empty state:** نفس نمط `reviews-panel.tsx:137-149` (أيقونة + سطر نص، لا illustration).
- **ألوان الحالة (Badge):** نفس `STATUS_META` الموجود بالفعل في `update-detail-dialog.tsx:63-72` حرفياً — **يُستورد لا يُعاد كتابته.**

### الجدول

| Component | المسار (موجود بالفعل) | الاستخدام في Session A | ملاحظة |
|---|---|---|---|
| `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` | `components/ui/dialog.tsx` | حاوية الفورم | نفس حجم `sm:max-w-lg` المستخدم في `update-detail-dialog.tsx:195` |
| `Button` | `components/ui/button.tsx` | إرسال/حفظ كمسودة/إلغاء | نفس variants (`default`/`outline`/`ghost`) المستخدمة في نفس الملفين، بلا className ألوان hardcoded |
| `Input` | `components/ui/input.tsx` | حقل العنوان | — |
| `Textarea` | `components/ui/textarea.tsx` | الوصف/العمل المنجز/المتبقي | نفس الكومبوننت المستخدم فعلاً لسبب الرفض/الإلغاء القسري في `update-detail-dialog.tsx:270,292` |
| `Label` | `components/ui/label.tsx` | تسميات الحقول | — |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` | `components/ui/select.tsx` | اختيار المشروع ثم المرحلة | **مُستخدَم فعلياً** في `subcontractors/page.tsx` — ليس component ميت، آمن الاعتماد عليه |
| `Badge` | `components/ui/badge.tsx` | حالة التقرير (مسودة/معلّق/مرفوض...) | يستورد `STATUS_META` من `update-detail-dialog.tsx` |
| `Loader2`, `AlertCircle`, `AlertTriangle`, `CheckCircle2`, `XCircle` (lucide-react) | مُستخدَمة بالفعل في نفس الملفين | spinners/تنبيهات | نفس الأيقونات بالظبط، بلا استيراد أيقونات جديدة |
| `PhaseAdminControls` (نمط لا كومبوننت) | `components/dashboard/projects/phase-admin-controls.tsx` | **نمط** الزرار-جوّه-صف-المرحلة اللي بيفتح `Dialog` | يُقلَّد هيكلياً، لا يُستورد (كومبوننت مختلف الغرض) |

### ما لن يُستخدم (وليه)
- **`sonner` (toast)** — موجود (`components/ui/sonner.tsx`) لكن **الصفحة المرجعية نفسها لا تستخدمه إطلاقاً** (كل الأخطاء inline). الالتزام بـ "نفس المنصة" يعني تجاهله هنا رغم توفره.
- **`Progress` (components/ui/progress.tsx)** — **صفر استخدام حالي بالمشروع بالكامل** (تحقّق بـ grep). شريط تقدم المرحلة في نفس الصفحة بيستخدم helper محلي `getProgressBar` (سطر 185-197، div يدوي) لا هذا الكومبوننت. Session A لا تحتاج شريط تقدم أصلاً (حقل رقمي `progressIncrement` بس)، فلا داعي له.
- **مكتبة UI جديدة / package جديد** — **صفر**. كل المطلوب موجود في الجدول أعلاه.

### المتوقَّع في التقرير النهائي (قاعدة المالك)
بناءً على الجرد ده: **القائمة المتوقَّعة لأي component/style جديد = فاضية.** لو ظهر أي شيء جديد فعلاً أثناء التنفيذ، هذا انحراف عن الـ plan يستوجب وقفة ✋ قبل ما يُكتب، مش بعد.

---

## 👤 الأدوار (من الـ guards حرفياً — صفر اختراع)

من `apps/api/src/modules/updates/updates.controller.ts:38-44`:
```ts
const FIELD_ROLES = ['SUPER_ADMIN','PROJECT_MANAGER','SITE_ENGINEER','SUPERVISOR','WORKER'] as const;
```
هذا هو **بالظبط** مين يقدر ينشئ/يعدّل/يبعت تقريراً (`@Roles(...FIELD_ROLES)` على `create`/`editDraft`/`submit` — `updates.controller.ts:87,102,117`). **`ACCOUNTANT` و`CLIENT` مستبعدان** من الإنشاء (يشوفان فقط عبر `VIEWER_ROLES`).

**هل WORKER له شكل تقرير مختلف بالباك إند؟ لا.** تحقّق مباشر من `apps/api/src/modules/updates/dto/index.ts` — `CreateUpdateDto` واحد لكل الأدوار في `FIELD_ROLES` بلا أي تفرّع حسب الدور (نفس الحقول: title/description/workDone/workRemaining/workersCount/workHours/materialsUsed/cost/progressIncrement لكل الأدوار بالتساوي، بما فيهم WORKER). **الفورم هيبقى نفسه لكل الأدوار المسموح لها — مفيش حقل هيتخفى أو يتخترع حسب الدور.**

**الفرق الوحيد الحقيقي بين الأدوار هنا** هو فحص التعيين (`updates.service.ts:214-222`): `SUPER_ADMIN`/`PROJECT_MANAGER` معفيّان من فحص `ProjectAssignment`، والباقي (بما فيهم WORKER) **لازم** يكون معيّن على المشروع (`projectId, userId, removedAt: null`).

**الزرار في الـ UI يظهر لمين؟** بنفس نمط `const role = me?.role` الموجود بالفعل في `projects/[id]/page.tsx:150-154` (`canReview`/`canForceCancel`) — نضيف:
```ts
const canSubmitReport = ['SUPER_ADMIN','PROJECT_MANAGER','SITE_ENGINEER','SUPERVISOR','WORKER'].includes(role);
```
نفس القائمة، بنفس الترتيب، بلا إضافة أو حذف. **هذا تجميل UX فقط — الباك إند هو الحكم الحقيقي** (نفس التعليق الصريح الموجود في `update-detail-dialog.tsx:21`).

---

## 🏗️ المشاريع والمراحل — "المتعيَّن عليه بس"

**لا حاجة لأي فلترة جديدة في الفرونت إند — الباك إند يعملها بالفعل:**
- `GET /projects` (`projects.service.ts:83-91`): لـ `SITE_ENGINEER`/`SUPERVISOR`/`WORKER` (أي دور غير `SUPER_ADMIN`/`PROJECT_MANAGER`/`CLIENT`) الاستعلام بيُقيَّد تلقائياً بـ `assignments: { some: { userId, removedAt: null } }`. **`useProjects()` الموجود فعلاً** (نفس الهوك المستخدم في `reviews/page.tsx`) يرجّع المشاريع المتعيَّن عليها المستخدم بس، بدون أي تعديل.
- المراحل: التعيين على مستوى **المشروع لا المرحلة** (`projects.service.ts:578-581`) — فور المرور من `ensureProjectAccess`، كل مراحل المشروع (`project.phases`، جاية بالفعل من `useProject(projectId)`) مرئية. **لا حاجة لفلترة مراحل منفصلة.**

**تصميم الاختيار:** Dropdown مشروع (`useProjects()`) → Dropdown مرحلة (`project.phases` من `useProject(selectedProjectId)`) — أو ببساطة أكتر: بما إن الزرار هيكون **جوّه** تبويب "المراحل" في صفحة مشروع محدد أصلاً (مش شاشة مستقلة)، **فمفيش حاجة لاختيار مشروع/مرحلة من الأساس** — المستخدم أصلاً واقف على صف المرحلة اللي عايز يبعت تقريرها. ده أبسط من إضافة Select مزدوج، وأكثر اتساقاً مع مكان الزرار (نفس منطق `PhaseAdminControls` اللي بياخد `phase`/`projectId` كـ props جاهزة من الصف، سطر 403-409).

---

## 🔄 احترام الـ state machine (بلا إضافة أو حذف)

من `updates.service.ts` (مقروء بالكامل):
- **إنشاء:** `POST /phases/:phaseId/updates` → `DRAFT` فقط.
- **مسودة ← مرفوض قابلان للتعديل:** `PATCH /updates/:id` (`editDraft`, سطر 310-373) — REJECTED بيرجع DRAFT عند التعديل وبيمسح `rejectionReason`/`reviewedBy`/`reviewedAt` **تلقائياً بالباك إند** (سطر 343-346) — الفرونت إند **ملوش دخل** في مسح الحقول دي.
- **إرسال:** `POST /updates/:id/submit` → `DRAFT → PENDING` فقط (لازم عنوان غير فاضي).
- **لا تجاوز:** PENDING/APPROVED/FORCE_CANCELLED **غير قابلين للتعديل من الفورم ده إطلاقاً** (`editApproved`/`forceCancel` خارج نطاق Session A بالكامل — دول أفعال PM/SUPER_ADMIN من `update-detail-dialog.tsx` الموجود).

**هل المهندس بيشوف سبب الرفض؟ أيوه.** `rejectionReason` موجود في استجابة `GET /updates/:id` (`updates.service.ts:145-172`) و`GET /phases/:phaseId/updates` (السطر 125 ضمن الـ select) — **الفورم الجديد هيعرضه بنفس الـ banner الأحمر الموجود بالفعل في `update-detail-dialog.tsx:255-262** (نفس الكلاسات، نفس الأيقونة، نفس الموضع) لما يفتح تقريراً REJECTED.

**هل يقدر يعدّل ويبعت تاني؟ أيوه** — نفس الفورم، في وضع "تعديل"، بيستدعي `editDraft` ثم `submit` (مرتين منفصلتين، زي الباك إند بالظبط — **لا endpoint واحد يعمل الاتنين**).

**تصميم "زرار المرحلة" المقترح** (استنتاج من القواعد أعلاه، لا افتراض جديد):
| حالة تقرير اليوم لهذه المرحلة (من `GET /phases/:phaseId/updates`، بلا status filter — الباك إند بيرجّع own∪APPROVED تلقائياً لـ FIELD role) | الزرار/الشارة |
|---|---|
| لا يوجد | "تقرير جديد" → فورم فاضي → `create` |
| DRAFT أو REJECTED (بتاع نفس المستخدم) | "متابعة التقرير" → فورم معبّأ بالبيانات الموجودة (+ banner الرفض لو REJECTED) → `editDraft` ثم `submit` |
| PENDING أو APPROVED | شارة حالة بس، بلا زرار — الباك إند أصلاً **بيمنع** تقريراً تانياً نشطاً لنفس اليوم/المرحلة/المستخدم (`updates.service.ts:224-271`, CVE-UPD-003) فعرض زرار "تقرير جديد" هنا هيـ 409 دايماً |

هذا الاستعلام **موجود بالفعل** (`phaseUpdatesQueryOptions`, نفس اللي بيستخدمه `ReviewsPanel`) — صفر endpoint جديد، صفر hook جديد للقراءة (الجديد بس mutations الإنشاء/التعديل/الإرسال).

---

## 📶 الشبكة الضعيفة

**(أ) الإرسال فشل → الكلام يفضل في الفورم:** الفورم بيحتفظ بالـ state المحلي بتاعه ولا يُغلَق/يتصفّر إلا بعد `onSuccess`. نفس نمط `projects/new/page.tsx` (`formError` + `createProject.error` يتعرضا سوا، الفورم ما بيتمسحش).

**(ب) idempotency key على الـ create — 🔴 نقطة قرار قبل الـ plan:**
تحقّق مباشر: `POST /phases/:phaseId/updates` (`updates.controller.ts:86-95`) **ما بيستقبلش `Idempotency-Key` header إطلاقاً** — ولا decorator `@IdempotencyKey()` عليه (الموجود بس على `approve`/`force-cancel`). إضافة header-based idempotency حقيقي = **تعديل باك إند** (controller + service + مقارنة fingerprint) — **ممنوع صراحةً في هذه الجلسة.**

**لكن الحماية الفعلية موجودة بالفعل بشكل مختلف:** قاعدة I9 في `create()` (سطر 224-271) — Serializable transaction بتمنع أكتر من تحديث نشط (DRAFT/PENDING/APPROVED) لنفس (مستخدم × مرحلة × يوم)، وترجع `409 ConflictException` برسالة عربية واضحة لو اتكرر. **ده نفس الموقف اللي `useCreateProject` (الموجود فعلاً) موثّق عليه حرفياً:**
> "a create is not idempotent at this endpoint (no Idempotency-Key like payments)... we deliberately do NOT set retry" (`use-create-project.ts:6-9`)

**التصميم المقترح (بديل، صفر لمس باك إند):**
1. **منع الضغطة المزدوجة من الأساس:** الزرار يتقفل فوراً عند أول ضغطة (`isPending`) — نفس (ج) أدناه — فمفيش طلب تاني يتبعت من نفس الفورم وهو شغال.
2. **`retry: false`** على الـ mutation (نفس كل الـ mutations التانية في `use-update-actions.ts` — اتساق لا استثناء).
3. **409 Conflict من الباك إند = الشاهد الحقيقي الوحيد ضد التكرار** (مش key): لو حصل double-submit فعلي (تابين مفتوحين، إلخ) الباك إند نفسه بيرفض الثاني برسالته الجاهزة ("لديك تحديث ... على هذه المرحلة اليوم") — الفورم بيعرضها زي أي خطأ backend عادي، **ومايعملش تقريرين.**

**ده مش idempotency key حرفياً — ده الحماية الموجودة فعلاً بديلة له على نفس الـ endpoint، وبتحقق نفس الهدف المذكور ("الضغطتين ميعملوش تقريرين").** محتاج موافقتك الصريحة على الحل ده قبل ما يتكتب في الـ plan، لأنه **انحراف عن الصياغة الحرفية لطلبك** (idempotency key) رغم إنه بيحقق نفس النتيجة بدون لمس الباك إند.

**(ج) الزرار يتقفل وهو بيبعت:** `disabled={mutation.isPending}` + spinner `Loader2` — نفس النمط الموجود حرفياً في `update-detail-dialog.tsx:327-334` (زرار الاعتماد).

---

## 📸 الصور — ليست في Session A

مكان واضح في الفورم مكتوب فيه **"الصور — قريباً"** (نص رمادي مصحوب بأيقونة محايدة، بلا أي input أو زرار تفاعلي، بلا drag-drop placeholder يوحي بوظيفة غير موجودة). صفر استدعاء لأي من `media.*` endpoints في هذه الجلسة.

---

## 📱 Mobile-first / RTL

- يُصمَّم على **360px أولاً** (base Tailwind بلا prefix)، ثم `sm:`/`md:` للتوسيع — نفس اتفاقية باقي المشروع (`reviews-panel.tsx`, `dashboard/reports/page.tsx` بالفعل بـ `px-3 sm:px-8` إلخ).
- خانات وأزرار كبيرة باللمس (نفس ارتفاعات `Button`/`Input` الافتراضية في `components/ui` — بلا تصغير يدوي).
- عربي RTL: المشروع كله `[locale]`-aware، ونفس نمط `locale === "ar"` الشرطي المستخدم في كل الملفات المرجعية — **لا نستخدم `useTranslations` JSON keys هنا** لأن الصفحة المرجعية (`update-detail-dialog.tsx`/`reviews-panel.tsx`) بتستخدم inline ternary (`ar ? "..." : "..."`) لا ملفات الترجمة — اتساق مع المرجع المختار صراحةً.
- الـ `Dialog` نفسه `max-h-[85vh] overflow-y-auto` (نفس `update-detail-dialog.tsx:195`) — يشتغل على شاشة صغيرة بالفعل بنفس الآلية المُستخدَمة في شاشة المراجعة.

---

## 🧭 جرد الحدود (قاعدة #11)

### (أ) حد السجل — grep على BACKLOG.md لكل ملف متأثر

```
grep -n -e "projects/\[id\]/page.tsx" -e "phase-admin-controls.tsx" \
        -e "updates-client.ts" -e "use-update-actions.ts" -e "types/update.ts" \
        -e "update-detail-dialog.tsx" -e "reviews-panel.tsx" \
        .claude/sessions/BACKLOG.md
```

النتائج:
1. `projects/[id]/page.tsx` → **WEB-S3-002** (🟢 LOW، render-tests لحالات error/404 مؤجّلة، مربوطة بـ WEB-S1-004 infra) — **تُلمَس بلا إغلاق**: هذه الجلسة بتعدّل نفس الملف لكن مش هتضيف render-tests (خارج النطاق، يحتاج infra لسه معلّق). تُذكَر هنا بدل ما تُنسى.
2. `phase-admin-controls.tsx` → **WEB-S4-SWAP-001** (🟡 MEDIUM، إعادة الترتيب غير ذرية) — **ملف مرجعي فقط (يُقرأ نمطه، لا يُعدَّل)**، فلا تُلمَس أصلاً.
3. `update-detail-dialog.tsx` → **WEB-S4-ERR-001** (🟢 LOW، رسالة خطأ عامة) — ملف مرجعي فقط في Session A (التعديل الفعلي عليه مؤجَّل لـ Session B حسب التقسيم المعتمد)، **لا تُلمَس هنا.**
4. الباقي (`updates-client.ts`, `use-update-actions.ts`, `types/update.ts`, `reviews-panel.tsx`) → **لا يوجد.**

### (ب) حد البنود — داخل هذا الـ scope

- بند "زرار تقرير جديد داخل صف المرحلة" وبند "`PhaseAdminControls` الموجود في نفس الصف" — **نفس الصف بالضبط، عنصر DOM مجاور.** الأثر: لازم spacing/ترتيب واضح (زرار التقرير يسار، أزرار الإدارة يمين أو العكس حسب RTL) عشان ميتلخبطوش بصريًا على عرض 360px — يُحسَم في الـ plan (تخطيط دقيق)، مش قرار ضمني وقت الكتابة.
- بند "الحماية ضد الضغط المزدوج (409 بديل الـ key)" وبند "قفل الزرار وقت الإرسال (ج)" — **يعتمد الأول على الثاني فعلياً**: لو الزرار ما اتقفلش صح، الاعتماد الكامل بيبقى على الباك إند وحده (409 بعد الحقيقة لا قبلها) — **مش مستقلَّين، (ج) هو خط الدفاع الأول و(ب) هو الشبكة الثانية.** يُكتَب صراحة في الـ plan كترتيب أولوية لا بديلين متكافئين.
- باقي البنود: مستقلة.

### (ج) حد الوحدات — الحقيقة ومصادرها

- **"FIELD_ROLES = 5 أدوار"** — مصدر واحد مباشر (`updates.controller.ts:38-44`)، نفس القائمة تتكرر حرفياً في `updates.service.ts` (`ADMIN_TIER_ROLES` بالعكس تحديداً — لا تعارض، تكامل).
- **"الباك إند ما بيفرّقش بين الأدوار في شكل الـ DTO"** — مصدر واحد (`dto/index.ts` قراءة كاملة)، لا مصدر ثانٍ (لا توثيق منفصل يدّعي العكس).

---

## 🛡️ فحص #7أ (إلزامي حتى لو الـ mode محسوم بالفعل)

- **المعيار 1 (الدلالة):** لا — "مين يعدي" ثابت تماماً (نفس FIELD_ROLES، نفس فحص التعيين)، الفرونت إند بيستهلك قراراً أمنياً قائماً، ما بيغيّروش.
- **المعيار 2 (سطح هجوم جديد):** لا — zero كود جديد على `auth`/`payments`/`audit`/صلاحيات؛ الملفات المتأثرة كلها UI استهلاك، صفر لمس لـ `client.ts` أو `route-guard.tsx` أو أي طبقة جلسة. **لو ظهر أثناء التنفيذ إن أي تغيير محتاج يلمس حد من دول، تتوقف الجلسة فوراً وتترقّى لـ Deep — ده شرط صريح من طلبك.**
- **الخلاصة:** Standard تتأكد، صفر مبرر للترقية.

---

## ❓ ما لم أتأكد منه (ولم أخمّنه)

- شكل حقيقي على شاشة 360px حية (لم يُشغَّل متصفح في هذه الجلسة بعد — هيُختبَر فعلياً في مرحلة التنفيذ/الاختبار، مش الآن وقت الـ scope).
- هل هناك سيناريو عملي يخلي نفس المستخدم يفتح تابين/نافذتين على نفس المرحلة في نفس اليوم؟ افترضت نعم كسيناريو نظري يبرر البند (ب)، لكن معدّل حدوثه الفعلي غير معروف.

## 🔴 نقطة واحدة تحتاج قرارك قبل الـ plan
البند **(ب)** أعلاه (idempotency-key بديل عبر 409 + قفل زرار، بدل header حرفي على الباك إند) — موافق عليه كحل، ولا تفضّل خياراً آخر (مثلاً: وقف الجلسة وتعديل الباك إند لإضافة الـ header، رغم إن ده هيكسر "ممنوع لمس الباك إند")؟

## تعريف النجاح (لهذا الـ scope)
- [x] جرد Components كامل بمسارات حقيقية + صفحة مرجعية محددة بالاسم
- [x] الأدوار منقولة حرفياً من الـ guards (ملف:سطر)، صفر اختراع، وضّح إن WORKER بلا فرق شكلي
- [x] المشاريع/المراحل: الفلترة موجودة بالفعل بالباك إند، موثّقة بملف:سطر
- [x] الشبكة الضعيفة: 3 بنود مغطاة، وبند (ب) موسوم صراحة كنقطة قرار
- [x] state machine موضّح بالكامل مع تحقق "شوف سبب الرفض + عدّل وابعت تاني"
- [x] الصور: مكان "قريباً" محدد، صفر زرار وهمي
- [x] جرد الحدود (أ/ب/ج) منفَّذ فعلياً لا افتراضاً
- [x] فحص #7أ مُجاب عليه صراحة رغم إن الـ mode محسوم

---
⏸️ AWAITING APPROVAL — رد بـ "approve" للانتقال للـ plan، أو جاوب على نقطة القرار الحمراء أولاً لو عايز حل مختلف لبند (ب).

✋ تم السكوب — في انتظار موافقتك قبل كتابة 00-plan.md (ملف واحد في كل مرة، زي القاعدة).
