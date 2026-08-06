# تقرير الهاكر — S4: Updates Workflow + Review Inbox

**Hacker mode:** attack-and-fix (default، من الـ scope).
**منهجية:** هاجمت الـ frontend المنفّذ (المراحل 1–5) **مقابل الـ backend الفعلي** — مش افتراضات. قرأت `updates.service.ts` (كامل)، `updates.controller.ts` (كامل)، `idempotency.service.ts` (كامل) لأثبّت سقوف الخطر بالمصدر، مش بالتقرير.

---

## Attack Vectors المفحوصة
- [x] Authentication bypass — (خارج النطاق: الـ Bearer/refresh مضمون S3؛ الـ backend خلف JwtAuthGuard + `@Roles`)
- [x] Authorization (IDOR, privilege escalation) — **مفحوص** (role gating + cross-tenant getUpdate)
- [x] Input validation (reason min-length, injection) — **مفحوص**
- [x] Tenant isolation — **مفحوص** (aggregation محدود بمشروع واحد)
- [x] Business logic abuse (state machine) — **مفحوص** (approve/reject/force-cancel guards)
- [x] Double submit / race conditions — **مفحوص** (idempotency holder stability + double-click)
- [x] Idempotency-Key drift/reuse — **مفحوص بعمق** (الجوهر الأمني للجلسة)
- [ ] File upload exploits — N/A (لا رفع في هذه الجلسة)
- [x] Audit log tampering — N/A frontend (الـ backend يسجّل in-tx)

---

## الثغرات المكتشفة

### [CVE-S4-001] `reason-change-after-failure` → 422-loop على force-cancel
- **الخطورة: LOW** (liveness/UX — **ليست safety**؛ يؤكّد تقييم المخطط الأوّلي).
- **الموقع:** `components/dashboard/updates/update-detail-dialog.tsx` — الـ `cancelKey` holder + Textarea الخاص بـ force-cancel.
- **السيناريو (خطوة بخطوة):**
  1. SUPER_ADMIN يفتح force-cancel على update معتمد، يُدخل reason R1 (≥20)، يؤكّد → `cancelKey.current()` يولّد **K**.
  2. الطلب يفشل فشلاً غير-committed (409 من in-tx re-read، أو 500، أو network). `reset()` لا يُنادى (يحدث في `onSuccess` فقط) → **K يبقى مخزّناً**.
  3. المستخدم **يعدّل الـ reason** إلى R2 ويعيد التأكيد → `current()` يرجّع **نفس K**، لكن الـ body تغيّر.
  4. الـ backend: `fingerprintBody = {updateId, action:'force_cancel', reason}` (`updates.service.ts:602-606`) → `lookup` يجد K بـ fingerprint(R1) ≠ fingerprint(R2) → **422** (`idempotency.service.ts:55-62`).
  5. المستخدم عالق: كل إعادة بنفس المفتاح + reason معدّل = 422 صامت (الرسالة generic).
- **إثبات سقف الخطر (لماذا LOW مش CRITICAL):** حتى مع إعادة توليد المفتاح (الخيار أ)، **لا يمكن double-apply**:
  - `APPROVED → FORCE_CANCELLED` أحادي الاتجاه لا رجعة.
  - أي محاولة force-cancel على update صار FORCE_CANCELLED ترفضها الحارس **400** pre-tx (`updates.service.ts:634`) + re-check in-tx (`:664`, CVE-UPD-005).
  - فالـ 422 نفسه ناتج آمن؛ والخيار أ محميّ بالـ state machine كـ backstop. صفر double SUNK_COST، صفر double progress-reversal ممكنان.
- **القرار (أ vs ب):** اخترت **الخيار أ** (reset المفتاح عند تغيير الـ reason) لأنه: (1) آمن — السقف مقفول بالـ state machine؛ (2) reason معدّل = فعل منطقي جديد، فمفتاح جديد صحيح دلالياً؛ (3) يحلّ الـ 422-loop. الخيار ب (إبقاء الحالي + تحسين رسالة الخطأ) أضيق لكنه يترك المستخدم عالقاً حتى close+reopen — UX أسوأ بلا مكسب أمني (كلاهما آمن).
- **الإصلاح المطبّق:** في `onChange` الخاص بـ Textarea الـ force-cancel: `setReason(...)` **+** `cancelKey.current.reset()`.
  - **الحفاظ على الـ idempotency (rule #4 — الأعمق):** إعادة بنفس الـ reason **لا تُطلق onChange** → المفتاح يبقى ثابتاً → الـ backend يعيد التشغيل idempotently. فقط تغيير الـ reason (keystroke) يُسقط المفتاح. أي: "نفس النية = نفس المفتاح، نية مختلفة = مفتاح جديد" — بالضبط عقد الاستقرار الصحيح.
  - **إغلاق كل المسارات:** لا يمكن تأكيد force-cancel إلا بعد `reason.length ≥ 20`، والطريق الوحيد لذلك هو الكتابة في الـ Textarea (onChange). فأي تأكيد يسبقه keystroke → المفتاح يوافق الـ reason الأخير دائماً. مسار Back→re-enter (setReason("")) مغطّى ضمناً (الـ min-length يفرض keystroke جديد).
  - `approveKey` **لم يُمَس**: fingerprint الـ approve `{updateId, action:'approve'}` بلا reason → منيع ضد هذا النمط أصلاً.
- **الحالة: FIXED-BY-HACKER ✅** (تغيير موضعي، غير معماري).

---

## Attack vectors هُوجمت ولم تُنتج ثغرة (بأدلة)

### [ATT-2] استقرار الـ Idempotency-Key عبر double-click / re-render — **آمن**
- **الهجوم:** لو الـ `useRef(createIdempotencyKeyHolder())` أُعيد إنشاؤه بين نقرتين → مفتاح جديد → double-apply للـ approve/SUNK_COST.
- **النتيجة:** المفتاح ثابت. دفاع ثلاثي الطبقات:
  1. **`UpdateDetailDialog` مُثبّت دائماً** في `reviews-panel.tsx:163` (غير مشروط، لا `key` prop مربوط بـ updateId) → الـ holder يعيش عبر open/close و re-renders الأب. `useRef` initial-value يُهمَل بعد أول render (سلوك موثّق).
  2. **`current()` lazy-cached** → أي نقرة/render تالٍ يرجّع **نفس K** حتى `reset()`.
  3. **`disabled={busy}`** (isPending) يمنع النقرة الثانية أثناء الطيران؛ وحتى لو تسرّبت، `current()` = نفس K → الـ backend idempotent (`updates.service.ts:418-423`).
- **حارس معماري للمبرمج (تحذير):** **ممنوع** إضافة `key={updateId}` على `<UpdateDetailDialog>` — سيفرض remount يعيد تهيئة الـ holder ويفتح double-apply. الحالي صحيح (updateId كـ prop عادي + `useEffect([updateId])` للـ reset).

### [ATT-3] role gating bypass — **آمن (الـ backend هو البوابة)**
- **الهجوم:** المستخدم يعبث بـ `me.role` client-side (DevTools) → أزرار approve/force-cancel تظهر لدور ميداني.
- **النتيجة:** الأزرار UX فقط؛ الطلب يصطدم بحارس الـ backend:
  - approve/reject → `@Roles('SUPER_ADMIN','PROJECT_MANAGER')` (`updates.controller.ts:133, 145`).
  - force-cancel → `@Roles('SUPER_ADMIN')` (`:161`).
  - الـ frontend gates (`canReview = SUPER_ADMIN|PROJECT_MANAGER`, `canForceCancel = SUPER_ADMIN`, `page.tsx:131-132`) **تطابق الـ backend حرفياً**. العبث → 403. صفر تصعيد.

### [ATT-4] state machine assumptions — **آمن (backend مُصلّد)**
- approve على غير-PENDING → 400 (`:441`) + in-tx re-read (`:457`, CVE-UPD-008).
- force-cancel على غير-APPROVED → 400 (`:634`) + in-tx re-read (`:664`, CVE-UPD-005).
- reject على غير-PENDING → 400 (`:560`).
- **stale status في الـ UI:** الـ dialog يعرض الأزرار حسب `update.status` من `useUpdate(id)` (detail حديث)، لا حسب صف القائمة. لو صار stale (غُيّر من جلسة أخرى)، النقر يُرجع 400/409 والـ mutation يـ invalidate → refetch. آمن؛ سلوك متوقّع.

### [ATT-5] `useEffect([updateId])` reset — **يعمل صح**
- فتح A: updateId `null→A` → الـ effect يـ reset المفتاحين + mode=view + reason="". ✅
- تبديل A→B (أو close→open): أي تغيّر في updateId يُطلق الـ effect → **update جديد لا يرث مفتاح سابق**. ✅
- إعادة فتح **نفس** A بعد close: `A→null→A` → reset مزدوج → مفتاح نظيف (هذا هو الـ escape hatch الأصلي، وبعد إصلاح CVE-S4-001 لم يعد ضرورياً لكنه سليم).

### [ATT-6] tenant isolation / IDOR على getUpdate — **آمن**
- `useUpdate(id)` مجرّد GET؛ الـ backend `findOne` يفرض `companyId` ويرجّع **404** على cross-tenant + على انتهاك visibility (CVE-UPD-006، `updates.service.ts:175-196`) — لا enumeration عبر 403/404 diff.
- الـ aggregation في `reviews-panel` محدود بـ `project.phases` (نفس المشروع/التينانت) — لا سطح N+M عام.

### [ATT-7] input validation (reason) — **آمن (backend authoritative)**
- الـ frontend `disabled` حتى ≥10 (reject) / ≥20 (force-cancel) = UX فقط. الـ backend DTOs (`RejectUpdateDto` 10–1000، `ForceCancelDto` 20–2000) هي الحارس. تجاوز الـ disabled عبر DevTools → الـ backend يرفض 400.

---

## ملخص الإصلاحات
- CRITICAL: 0 لقى → 0.
- HIGH: 0 لقى → 0.
- MEDIUM: 0 لقى → 0.
- LOW: 1 لقى (CVE-S4-001) → اتصلح: 1 (FIXED-BY-HACKER).
- NEEDS-CODER: 0 → الجلسة **لم تتوقف**.

**Verification (literal) بعد الإصلاح** — `npx tsc --noEmit` (من `apps/web`):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ ... }' but required in type 'AuthState'.
---EXIT:2---
```
نفس الـ 5 baseline (WEB-TSC-001 ×2، WEB-TSC-002 ×2، WEB-STORE-001). **صفر خطأ جديد** من إصلاح CVE-S4-001.

---

## ثغرات لسه مفتوحة (مع مبرّر)
- **الرسالة generic عند فشل الفعل** (`update-detail-dialog.tsx:280`): "فشل تنفيذ الإجراء" لا تميّز 400/409/422/network. **مبرّر الإبقاء:** بعد CVE-S4-001 صار الـ 422 عبر الـ UI **غير قابل للوصول** (تغيير الـ reason دائماً يولّد مفتاحاً جديداً)؛ الرسالة التفصيلية تحسين UX منخفض، خارج سقف attack-and-fix. → BACKLOG (LOW).
- **`useRef(createIdempotencyKeyHolder())` eager-alloc** (nit من المخطط): تخصيص holder مُهمَل كل render. غير أمني، غير ضار. → BACKLOG (nit).

---

## توصيات للمختبر (MVT + إضافي)
الـ MVT الأربعة (الـ plan) قائمة وتغطّي عقد الاستقرار algorithmically. **أضِف تحديداً لتغطية CVE-S4-001** (rule #5 — إعادة هجوم الـ spec الجديد ضد نفس النمط "مفتاح ثابت + بيانات متغيّرة"):
1. **[CVE-S4-001 spec] holder reset-on-reason-change** (الأعمق، paired): على `IdempotencyKeyHolder` — `current()` → K1؛ بعد `reset()` → K2 ≠ K1؛ وبدون reset بين استدعاءين → **نفس** K. (يثبت "نية مختلفة = مفتاح جديد، نفس النية = نفس المفتاح").
2. **MVT-1 (updates-client) paired:** المفتاح الممرَّر لـ `forceCancelUpdate`/`approveUpdate` هو **نفسه** اللي يظهر في `seen.headers["Idempotency-Key"]` — مش مجرد صالح الشكل.
3. **MVT-4 (idempotency-key):** `generateIdempotencyKey()` يطابق `^[A-Za-z0-9_-]{16,64}$` (نفس backend regex) + قيم متمايزة؛ + `throw` عند غياب Web Crypto (مسار رفض weak-key).
4. **حالة same-reason retry (توثيقية/algorithmic):** استدعاء `current()` مرتين بلا onChange بينهما = نفس المفتاح (idempotent replay) — يميّزها عن مسار الـ reset.
5. state machine (تُغطّى backend-side؛ إن توفّر integration للـ frontend، تأكيد أن 400/409 من approve/force-cancel يُبقيان الـ dialog مفتوحاً + يعرضان الخطأ).

---
✋ تم الهاكر — للدور التالي (🧪 المختبر)؟
