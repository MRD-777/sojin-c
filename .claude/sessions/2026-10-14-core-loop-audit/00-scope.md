# Scope

## Mode: Standard
السبب: جرد (audit) للكود الحالي — صفر كود إنتاجي، المخرج هو القرار نفسه (تقسيم sessions). طلب المستخدم صراحةً: "Standard — scope بس، وقف ✋ بعد الـ scope".

## المهمة
جرد "الدايرة الأساسية" من الكود نفسه (لا من التوثيق): (1) إنشاء وإرسال تقرير يومي + صور بواسطة مهندس الموقع/المشرف/العامل، (2) مراجعة مدير المشروع (Review Inbox)، (3) عرض العميل للتقارير المعتمدة وصورها من الموبايل. لكل خطوة: الـ backend endpoint، صفحة الـ frontend، الصلاحيات، رفع الصور، والموبايل. ثم اقتراح تقسيم لـ sessions تنفيذية بالـ mode والساعات.

## الملفات المتأثرة (مُفحوصة فقط — صفر تعديل في هذه الجلسة)
- `apps/api/src/modules/updates/updates.controller.ts` + `updates.service.ts` + `updates.service.spec.ts` — قُرئت كاملة.
- `apps/api/src/modules/media/media.controller.ts` + `media.service.ts` + `media-security.service.ts` + specs — قُرئت كاملة.
- `apps/api/test/app.e2e-spec.ts` — فُحص (health check فقط، لا HTTP e2e حقيقي).
- `apps/web/src/lib/api/updates-client.ts` + `apps/web/src/types/update.ts` — قُرئا كاملين.
- `apps/web/src/components/dashboard/updates/reviews-panel.tsx` + `update-detail-dialog.tsx` — قُرئا كاملين.
- `apps/web/src/app/[locale]/dashboard/projects/reviews/page.tsx` + `projects/[id]/page.tsx` (أجزاء) — فُحصا.
- `apps/web/src/components/auth/route-guard.tsx` + `components/dashboard/primary-sidebar.tsx` + `secondary-sidebar.tsx` + `dashboard-layout.tsx` — فُحصت لصلاحيات/تنقّل الـ CLIENT.

**Service classes المذكورة (rule #6):** `UpdatesService` ≥1 spec (موجود، مكثّف) · `MediaService` + `MediaSecurityService` ≥1 spec (موجود، مكثّف) — لا تغيير مطلوب على أي منهم في هذه الجلسة.

---

## 🔍 جرد الدايرة الأساسية

### 1) إنشاء وإرسال التقرير اليومي (SITE_ENGINEER / SUPERVISOR / WORKER)

| العنصر | الحالة | التفاصيل |
|---|---|---|
| **Backend: إنشاء مسودة** `POST /phases/:phaseId/updates` | ✅ شغال ومختبَر | `updates.service.ts:202` — يتحقق من تعيين المستخدم على المشروع (`ProjectAssignment`)، ومنع تكرار (يوم واحد = تحديث نشط واحد) بـ Serializable tx (CVE-UPD-003). مُختبَر بكثافة في `updates.service.spec.ts` (`describe('create')`). |
| **Backend: تعديل مسودة/مرفوض** `PATCH /updates/:id` | ✅ شغال ومختبَر | ownership check (`getOwnedUpdate`)، REJECTED→DRAFT بيمسح بيانات الرفض (BUG-UPD-009). مُختبَر. |
| **Backend: إرسال للمراجعة** `POST /updates/:id/submit` | ✅ شغال ومختبَر | DRAFT→PENDING، يرفض عنوان فاضي. مُختبَر. |
| **Backend: رفع صورة (upload-url)** `POST /media/upload-url` | ✅ شغال ومختبَر | مسار + bucket يحددهم السيرفر فقط (`MEDIA_TYPE_POLICY`)، العميل ما يقدرش يختار. |
| **Backend: ربط الصورة بالتقرير** `POST /updates/:updateId/media` | ✅ شغال ومختبَر | تحقق magic-byte + حجم حقيقي بعد الرفع (`verifyUploadedFile`)، حذف orphan file لو فشل التحقق، quota على الحجم المُتحقَّق لا المُدَّعى. 41 test عبر `media.service.spec.ts` (26) + `media-security.service.spec.ts` (15). |
| **Frontend: صفحة/نموذج "تقرير جديد"** | ❌ مش موجود | بحث شامل في `apps/web/src` — لا يوجد أي component أو route لإنشاء/تعديل/إرسال update. `updates-client.ts` نفسه **ناقص الدوال**: فيه فقط `listPhaseUpdates` / `getUpdate` / `approveUpdate` / `rejectUpdate` / `forceCancelUpdate` — **لا يوجد `createUpdate` / `editDraft` / `submit` إطلاقاً** في طبقة الـ API client. |
| **Frontend: رفع الصور (UI)** | ❌ مش موجود | لا `uploadMedia` ولا أي `<input type=file>` أو مكوّن رفع متعلق بالـ updates في الكود. |
| **الصلاحيات** | ✅ backend (Layer 2+3) / n/a frontend | `@Roles(FIELD_ROLES)` على الـ controller + فحص `ProjectAssignment` + ownership داخل الـ service. لا UI لتقييمه لأنه غير موجود. |
| **الموبايل** | ❌ n/a | لا توجد صفحة لتقييم شكلها. |

### 2) مراجعة مدير المشروع (Review Inbox)

| العنصر | الحالة | التفاصيل |
|---|---|---|
| **Backend: قائمة + تفاصيل** `GET /phases/:phaseId/updates`, `GET /updates/:id` | ✅ شغال ومختبَر | فلترة حسب الدور (CLIENT=APPROVED فقط، ADMIN_TIER=حر، FIELD=own∪APPROVED) — CVE-UPD-001 مُغلقة ومُختبرة، وCVE-UPD-006 (404 بدل 403 لمنع enumeration) مُختبرة. |
| **Backend: اعتماد/رفض** `POST /updates/:id/approve`, `/reject` | ✅ شغال ومختبَر | idempotent (approve)، re-read داخل الـ tx (CVE-UPD-008)، audit كامل. مُختبَر بكثافة (10+ حالات). |
| **Frontend: صفحة الـ Review Inbox** | ✅ موجودة ومتربطة بـ API حقيقي | `projects/[id]/page.tsx` (tab "مراجعة التحديثات") ← `ReviewsPanel` (fan-out `useQueries` عبر phases المشروع) ← `UpdateDetailDialog` (approve/reject + idempotency key holders مملوكة من الصفحة). الصفحة المستقلة `projects/reviews/page.tsx` كانت mock (`WEB-S4-P7-001`) **واتقفلت فعلاً في 2026-07-13** — تحققت بالقراءة المباشرة: دلوقتي بتستخدم `useProjects()` حقيقي وتلنك لنفس الـ tab. صفر mock متبقٍّ هنا. |
| **رفع/عرض الصور في شاشة المراجعة** | 🟡 اتكتب، لكن الصور نفسها ماتتعرضش | `UpdateDetail` type (`types/update.ts:171`) فيه `media: UpdateMedia[]` ومُرجَع فعلاً من `GET /updates/:id`، لكن `UpdateDetailDialog.tsx` **لا يقرأ `update.media` إطلاقاً** — مفيش أي عرض للصور في شاشة المراجعة. مدير المشروع بيوافق/يرفض بناءً على نص فقط، من غير ما يشوف الصور اللي المفروض هي جوهر التقرير. |
| **الصلاحيات** | ✅ backend حقيقي / UI تجميلي فقط (موثّق في الكود) | `@Roles('SUPER_ADMIN','PROJECT_MANAGER')` على approve/reject بالباك إند. الـ UI بيستخدم `canReview` prop لإخفاء الأزرار فقط — تعليق صريح في الكود: "Actions are role-gated for UX only — the backend is the real authority". |
| **الموبايل** | ❓ مش متأكد | الـ Dialog قابل للتمرير (`sm:max-w-lg max-h-[85vh] overflow-y-auto`) والـ shell فيه bottom-nav للموبايل (`dashboard-layout.tsx`)، لكن محدّش شغّل المتصفح فعلياً على شاشة صغيرة لتقييم كيف هيبدو — ده استنتاج من الكود لا من معاينة حية. |

### 3) عرض العميل للتقارير المعتمدة وصورها من الموبايل

| العنصر | الحالة | التفاصيل |
|---|---|---|
| **Backend: قائمة/تفاصيل التحديثات للعميل** | ✅ شغال ومختبَر | `findAll`/`findOne` بيفرضوا `status=APPROVED` + `clientId === user.userId` حرفياً من السيرفر (CLIENT query.status يُتجاهل تماماً). مُختبَر صراحة. |
| **Backend: قائمة/عرض الصور للعميل** | ✅ شغال ومختبَر | `findByUpdate` و `getSignedReadUrl` في `media.service.ts` بيطبّقوا نفس القيد (APPROVED + ownership)، مع فشل موحّد كـ 404 لمنع enumeration. 4+ specs مخصصة لفروع CLIENT. |
| **Frontend: صفحة/مسار للعميل** | ❌ مش موجود إطلاقاً | بحث كامل في `apps/web/src` — لا يوجد أي route أو component خاص بدور CLIENT لعرض التقارير أو الصور. |
| **فجوة أعمق من مجرد "صفحة ناقصة"** | ❌ لا يوجد role-based routing أصلاً | `route-guard.tsx` بيتحقق من تسجيل الدخول فقط (لا فرع على الدور). `primary-sidebar.tsx`/`secondary-sidebar.tsx` بلا أي شرط دور — نفس القائمة بالظبط (مشاريع، مالية، فريق، ...) لكل مستخدم. **يعني لو CLIENT سجّل دخول اليوم هيشوف نفس الـ shell الإداري** وهيضرب على endpoints مش مصرّح له بيها (403/404 فردي لكل صفحة) بدل واجهة مخصصة له. هذه فجوة جديدة لم تكن مسجّلة من قبل (انظر جرد الحدود أدناه). |
| **الموبايل** | ❌ n/a | لا توجد صفحة لتقييمها. |

---

## 🧭 جرد الحدود (قاعدة #11)

### (أ) حد السجل — grep فعلي على BACKLOG.md لكل ملف في "الملفات المتأثرة"

```
grep -n -e "updates.controller.ts" -e "updates.service.ts" -e "media.controller.ts" \
        -e "media.service.ts" -e "media-security" -e "update-detail-dialog.tsx" \
        -e "reviews-panel.tsx" -e "reviews/page.tsx" -e "updates-client.ts" \
        -e "route-guard.tsx" -e "primary-sidebar.tsx" -e "secondary-sidebar.tsx" \
        .claude/sessions/BACKLOG.md
```

النتائج وتصنيفها:
1. `reviews/page.tsx` → **WEB-S4-P7-001** — **تُقفَل** فعلاً (✅ DONE 2026-07-13، تحققتُ بالقراءة المباشرة أعلاه — لا mock متبقٍّ).
2. `update-detail-dialog.tsx:280` → **WEB-S4-ERR-001** (🟢 LOW، رسالة خطأ عامة لا تميّز status code) — **تُلمَس بلا إغلاق**: أي session قادمة هتعدّل نفس الملف (لعرض الصور) هتمر على هذا الكود بدون التزام بإصلاحه هنا؛ أذكرها كفرصة اختيارية في Session B أدناه.
3. `updates.controller.ts:38,47` → ملاحظة توثيقية (ليست تذكرة مفتوحة) عن `as const` على `FIELD_ROLES`/`VIEWER_ROLES`، مرتبطة بتذكرة typed-roles المُقفلة سابقاً — **لا أثر على هذه الجلسة**.
4. `route-guard.tsx` → تذكرتان مفتوحتان (حول 401 refresh / `retry:false`) — **غير متعلقتين** بفجوة الـ role-gating المكتشفة هنا؛ فجوة غياب التفرّع على الدور **لم تُسجَّل من قبل في BACKLOG** → بند جديد يُقترح فتحه (انظر أدناه).
5. الباقي (`media.controller.ts`, `media.service.ts`, `media-security.*`, `updates.service.ts`, `reviews-panel.tsx`, `updates-client.ts`, `primary-sidebar.tsx`, `secondary-sidebar.tsx`) → **لا يوجد** أي تطابق — لا تذاكر مفتوحة عليهم.

**تذكرة جديدة مقترحة (لم تُفتح بعد — تذكر هنا بدل ما تموت بالصمت):**
`WEB-CLIENT-GATE-001` — لا يوجد role-based routing/nav إطلاقاً؛ CLIENT يرى شاشات إدارية بالكامل. يُحلّ ضمن Session C أدناه.

### (ب) حد البنود — داخل هذا التقرير

- بند "Session B (صور المراجعة)" وبند "WEB-S4-ERR-001 المفتوحة" يشتركان في نفس الملف (`update-detail-dialog.tsx`) — **الأثر:** Session B فرصة رخيصة لقفل WEB-S4-ERR-001 بالمرة بدل تأجيلها مرة أخرى؛ أُدرجها كبند اختياري في نطاقها.
- بند "فجوة ❌ صور المراجعة" (الخطوة 2) وبند "فجوة ❌ CLIENT gating" (الخطوة 3) — ملفات مختلفة تماماً (`update-detail-dialog.tsx` مقابل `route-guard.tsx`) ولا تبعية بينهما تنفيذياً → **مستقلان**.
- بند "Session A" (نموذج إنشاء التقرير) وبند "Session B" (رفع الصور) يشتركان في الحاجة لإضافة دوال جديدة على `updates-client.ts` (A) مقابل عميل media جديد (B) — ملفات مختلفة (`updates-client.ts` مقابل عميل media غير موجود بعد) → **مستقلان تقنياً**، لكن **منطقياً B بلا جدوى production-ready بدون A** (لا يوجد تقرير يُرفَق عليه صور).

### (ج) حد الوحدات — الحقيقة ومصادرها

- **"41 test" لموديول media** (26 في `media.service.spec.ts` + 15 في `media-security.service.spec.ts`) — مصدر واحد مباشر (قراءة + `wc`/grep)، لا مصدر ثانٍ يتعارض معه.
- **"عمره ما شاف هاكر" لموديول media** — مصدر واحد: grep على 5 تقارير هاكر سابقة (`2026-05-16`, `2026-05-20`, `2026-05-21`, `2026-05-30`, `2026-07-16`) + سطر صريح في تقرير 2026-05-30: *"File upload exploits — خارج الموديول (media module) — N/A"*. لا تقرير آخر يذكر `media.controller.ts`/`media.service.ts`/`media-security.service.ts` بالاسم. لا تعارض ولا مصدر مزدوج.

---

## 🧩 اقتراح تقسيم الـ Sessions التنفيذية

### Session A — نموذج "تقرير يومي جديد" (Frontend فقط؛ الـ backend جاهز ومختبَر)
**Mode: Standard**
- **المعيار 1 (الدلالة):** لا — الصلاحيات موجودة ومُختبرة بالباك إند أصلاً، الفرونت إند هيستهلكها كما هي دون تغيير "مين يعدي".
- **المعيار 2 (سطح هجوم جديد):** لا — استهلاك endpoints موجودة ومفحوصة (`create`/`editDraft`/`submit`)، لا كود جديد على مسار أمني.
- **النطاق:** إضافة `createUpdate`/`editDraft`/`submit` لـ `updates-client.ts` + نموذج/صفحة "تقرير جديد" (عنوان، وصف، عمل منجز/متبقٍ، عدد عمال، ساعات، تكلفة، نسبة تقدم) + قائمة "تقاريري" (DRAFT/REJECTED قابلة للتعديل وإعادة الإرسال).
- **الساعات:** 6–8 ساعات.

### Session B — رفع الصور وعرضها في شاشة المراجعة
**Mode: Deep**
- **المعيار 1:** لا تغيير دلالي في الصلاحيات نفسها (الباك إند يفرضها أصلاً).
- **المعيار 2 — أيوه، وهو وحده كافٍ:** رفع الملفات سطح هجوم كلاسيكي (تزييف نوع الملف عبر `<input accept>`، تسريب EXIF/GPS عند عرض الصور للعميل لاحقاً، محاولات تجاوز الحجم/النوع من جهة العميل) **و`media.controller.ts`/`media.service.ts`/`media-security.service.ts` لم يرهم 🔴 هاكر قط** (مُثبَت بالـ grep أعلاه، وليس افتراضاً) ⇒ **Deep بلا مناقشة** حسب قاعدة #7أ.
- **النطاق:** مكوّن رفع (progress/retry/حدود الحجم من `MEDIA_TYPE_POLICY`) + استهلاك `upload-url`→PUT مباشر لـ Supabase→`POST /updates/:id/media` + **عرض الصور فعلياً** داخل `update-detail-dialog.tsx` (سد الفجوة 🟡 المكتشفة في الخطوة 2) + فرصة اختيارية لقفل `WEB-S4-ERR-001` بالمرة.
- **الساعات:** 10–14 ساعة.

### Session C — بوابة العميل (قراءة فقط: مشاريعي → تقارير معتمدة → صور)
**Mode: Deep**
- **المعيار 1 (الدلالة):** أيوه — أول مرة دور CLIENT ياخد صفحات/تنقّل خاص به على الفرونت إند؛ تغيير حقيقي في "مين يشوف إيه"، مش مجرد استهلاك موجود.
  - **ملحق اتجاه الفشل:** لو الـ role gating الجديد اتعمل غلط وفشل **مفتوحاً** (CLIENT يشوف شاشات إدارية بالخطأ، أو route جديد يُنسى حجبه عن غير العملاء) ⇒ **Deep بلا مناقشة** أصلاً — لا داعي حتى لسؤال المعيار 2.
- **المعيار 2:** أيضاً أيوه — `route-guard.tsx` كود غير مفحوص حالياً على مسار صلاحيات (مفيش فيه فرع على الدور إطلاقاً اليوم)، وإضافة الفرع ده **تعيد بناء** مساره بالكامل.
- **النطاق:** تفعيل role-based routing حقيقي في `route-guard.tsx` + nav مخصص لـ CLIENT (يخفي كل ما عدا "مشاريعي") + صفحة مشاريعي → تقارير معتمدة → تفاصيل + معرض صور، **mobile-first من البداية** (هو الاستخدام الأساسي المتوقع) + حل `WEB-CLIENT-GATE-001` + hacker pass كامل على الـ gating الجديد.
- **الساعات:** 12–16 ساعة.

### الترتيب المقترح والتبعية
A ← مستقلة تقنياً، لكن B بلا جدوى production بدونها (لا تقرير معتمد عليه صور لعرضه). C مستقلة تماماً عن A/B (تقرأ بيانات موجودة بالفعل حتى لو الصور لسه مش متاحة من الفرونت إند). **الترتيب الموصى به: A → B → C**، أو C بالتوازي مع A/B لو فيه أكتر من مطوّر.

**الإجمالي: 28–38 ساعة عبر 3 sessions.**

---

## ❓ ما لم أتأكد منه (ولم أخمّنه)
- الشكل الفعلي لـ `ReviewsPanel`/`UpdateDetailDialog` على شاشة موبايل حقيقية — لم يُشغَّل متصفح فعلي في هذه الجلسة؛ الاستنتاج أعلاه من قراءة الكود (Tailwind classes + `overflow-y-auto`) لا من معاينة حية.
- عدّاد PENDING لكل مشروع على صفحة `reviews/page.tsx` — الـ BACKLOG يذكر أنه "باقي مفتوح، يحتاج endpoint خلفي"؛ نقلتها كما هي من السجل، لم أتحقق بنفسي من عدم وجوده.
- أي تأثير إضافي لـ role-gating الجديد (Session C) على باقي الموديولات (finance/team/...) غير الدايرة الأساسية — خارج نطاق هذا الجرد عمداً (ركّزت على الدايرة الأساسية فقط كما طلبت).

## تعريف النجاح (لهذه جلسة الجرد)
- [x] جرد الخطوات الثلاث من الكود مباشرة (فُحصت الملفات الفعلية، لا التوثيق)
- [x] تقسيم مقترح لـ 3 sessions بـ mode مبرر بالمعيارين المستقلين (#7أ) لكل واحدة
- [x] تقدير ساعات صريح لكل session
- [x] كل نقطة غير مؤكدة موسومة ❓ صراحةً، بلا تخمين
- [x] جرد الحدود (أ) نُفِّذ بـ grep فعلي وليس افتراضاً، ونتائجه مُصنَّفة (تُقفَل/تُلمَس بلا إغلاق/لا يوجد)

## ملحوظة Push / Deploy Key
هذه الجلسة صفر كود — لا يوجد شيء يُدفَع. لو بدأنا تنفيذ Session A/B/C فعلياً وكانت الحاوية جديدة بلا صلاحية push، هل نحتاج نجهّز deploy key زي `INFRA-GIT-001`؟

---
⏸️ AWAITING APPROVAL — رد بـ "approve" لبدء أي من الـ sessions المقترحة (A/B/C)، أو "edit: [تعديل]" للتعديل على الجرد أو التقسيم.

✋ تم السكوب — الجلسة متوقفة هنا كما طُلب (Standard mode، scope بس). في انتظار توجيهك.
