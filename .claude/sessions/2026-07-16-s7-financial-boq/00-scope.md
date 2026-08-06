# Scope — S7: نظام المقايسات والإدارة المالية

## Mode: Deep
السبب: عمل مالي حسّاس (financial-critical) + يمسّ audit_log + صلاحيات متعددة الأدوار + 3 models جديدة + حسابات نقدية Decimal — القاعدة الذهبية (الأمان والمال أهم جزئين) تفرض red-team كامل + meta-review.

---

## المهمة
إضافة نظام مقايسات وإدارة مالية لكل مشروع: إعدادات مالية (`ProjectFinancialSettings`)، جدول كميات شجري (`BOQItem` + `BOQItemUpdate`)، وملخص مالي محسوب real-time من الـ DB (احتجاز/سلفة/مستحق صافي) — مع audit إجباري على تعديل الإعدادات، Decimal-only arithmetic، soft-delete على الـ BOQ، وصلاحيات مُحكمة لكل دور.

---

## الملفات المتأثرة

### Schema + Migration
- `apps/api/prisma/schema.prisma` — 3 models جديدة (`ProjectFinancialSettings`, `BOQItem`, `BOQItemUpdate`) + relations على `Project` و `Update` + entityType جديد في audit (نصّي، مفيش enum change متوقّع).
- `apps/api/prisma/migrations/<new>/migration.sql` — migration جديدة (SQL يُطبّق على Supabase `tbezbzlsuerjlohaoawy` عبر MCP بعد موافقة).

### Module جديد: `apps/api/src/modules/finance/`
> نقطة قرار للمخطط: module مستقل `finance` (يستورد `AuditModule` + `ProjectsModule`) بدل حشو كل ده في `payments`. `payments` يفضل مسؤول عن الحركات النقدية فقط؛ `finance` يملك الإعدادات + BOQ + الـ summary التجميعي. (الـ default المقترح = module مستقل.)
- `finance.module.ts` — يستورد AuditModule + ProjectsModule.
- `finance.controller.ts` — 9 endpoints (financial-settings ×2، financial-summary ×1، BOQ ×6).
- `financial-settings.service.ts` — GET/PATCH الإعدادات + audit على كل تعديل.
- `financial-summary.service.ts` — الحساب الـ real-time (Decimal-only).
- `boq.service.ts` — CRUD الشجري + soft-delete + link-update + حساب completedPct.
- `dto/index.ts` — DTOs (UpdateFinancialSettings, CreateBOQItem, UpdateBOQItem, LinkUpdate).

### قد تتأثر (يُراجَع في الـ plan)
- `apps/api/src/app.module.ts` — تسجيل `FinanceModule`.
- `apps/api/prisma/seed.ts` — بيانات ديمو للـ BOQ/settings (اختياري — يُقرّره المخطط).

---

## الاكتشافات المعمارية المُلزِمة (تُبنى عليها الخطة)

1. **`Update` مالوش `projectId` مباشر** — العلاقة `Update → Phase → Project`. الحساب `totalCompleted = Σ Update.cost حيث status=APPROVED` **لازم** يمرّ عبر `phase.project.id = projectId`. أي query مباشر على `Update.projectId` غلط.
2. **`ensureProjectAccess` لا يمرّر ACCOUNTANT تلقائياً** (`projects.service.ts:561`) — الـ early-return لـ `SUPER_ADMIN`/`PROJECT_MANAGER` فقط؛ CLIENT له فرع ownership؛ **باقي الأدوار (ومنهم ACCOUNTANT) لازم يكونوا assigned للمشروع**. المهمة تتطلب ACCOUNTANT يشوف كل حاجة مالية على أي مشروع. **نقطة قرار حرجة للمخطط:** إمّا (أ) توسيع `ensureProjectAccess` ليمرّر ACCOUNTANT company-wide، أو (ب) gate مالي منفصل في `finance` service. القرار يمسّ سلوك `payments` القائم أيضاً — يُوثّق ولا يُغيَّر ضمنياً.
3. **الـ summary لا يُخزَّن** — كل قيمة تُحسب per-request من الـ DB (عدا `ProjectFinancialSettings`). `netDue` مش عمود في أي جدول (منع manipulation).
4. **Decimal-only** — كل الحسابات بـ `Prisma.Decimal`، والإخراج `toFixed(2)` كـ strings على الـ boundary (نفس posture `payments.getSummary`). ممنوع `Number()`.
5. **`retentionReleased`** = `warrantyStartDate + warrantyMonths < today` — منطق تواريخ يحتاج تعريف دقيق للـ null-cases (warrantyStartDate = null ⇒ لسه مسلّمش).
6. **BOQ tree** — `parentId` self-relation؛ soft-delete على البند لازم يتعامل مع الأبناء (cascade soft-delete أو منع حذف بند له أبناء نشطون — نقطة قرار للمخطط).
7. **`completedPct` لكل BOQItem** — يُحسب من الـ `BOQItemUpdate` المرتبطة بـ Updates حالتها APPROVED (Σ cost linked / contractValue أو نسبة إنجاز — يُحدّدها المخطط بدقة). محسوب real-time، غير مخزّن.

---

## الـ Skills المستخدمة
- `02-database.md` — soft-delete، transactions، Decimal، self-relation tree.
- `03-auth-security.md` — الصلاحيات per-role، tenant isolation، `ensureProjectAccess`.
- `07-audit-compliance.md` — `logInTransaction` على تعديل الإعدادات + soft-delete الـ BOQ.
- `01-api-endpoints.md` — بنية الـ controller/DTO/validation.
- `06-error-handling.md` — رسائل الأخطاء العربية الموحّدة.
- `08-testing.md` — الـ MVT specs (service-layer، نمط payments.service.spec).

---

## تعداد الـ Services + ميزانية التغطية (Rule #6)
- `FinancialSettingsService` — **≥2 specs** (GET default-empty/existing، PATCH يكتب audit بالقيم old/new الفعلية — paired assertion على عمق الـ audit record مش surface).
- `FinancialSummaryService` — **≥2 specs** (الحساب الكامل بأرقام معلومة: totalCompleted/retention/advanceRecovered/netDue بـ Decimal؛ + حالة CLIENT بدون الإعدادات الداخلية).
- `BOQService` — **≥2 specs** (soft-delete لا يستدعي `delete()` أبداً + يكتب audit؛ + completedPct محسوب من APPROVED updates فقط، RejeCTED/PENDING مُستبعَدون).
- الحد الأدنى الإجمالي للـ MVT: **≥1 spec لكل fix من الـ plan + ≥1 لكل CVE-FIXED-BY-HACKER + ≥1 لكل architecture change** (يُحدَّد رقمه في `00-plan.md` قسم "تعريف النجاح").

---

## Hacker Mode (Rule #7)
**attack-and-fix** (default) — الهاكر يصلّح inline ما يقدر عليه (FIXED-BY-HACKER)؛ أي ثغرة تحتاج تغيير معماري ⇒ NEEDS-CODER (Rule #9 cycle).
محاور هجوم إجبارية: tenant isolation على الـ 3 models الجديدة، IDOR على `boqItemId`/`updateId`، privilege-escalation (PROJECT_MANAGER يعدّل الإعدادات؟ CLIENT يشوف الإعدادات الداخلية؟)، تلاعب مالي (قيم سالبة، advancePct>100%، ربط update من مشروع آخر بـ BOQItem)، audit tampering، cross-project link-update.

---

## الحدود (خارج نطاق هذا الـ session)
- **ربط الـ frontend** بأي endpoint من دول (صفحة Finance، BOQ tree UI) — **مؤجّل**. هذا backend-only.
- **R-1 (S7-blocker) توضيح:** R-1 هو frontend blocker على `apps/web/src/lib/api/client.ts` (مسار refresh-success غير مُختبَر) ويمنع **ربط** `payments/summary`/`financial-summary` في صفحة Finance. بما إن هذه الـ session لا تمسّ `client.ts` ولا تربط أي صفحة، **R-1 لا يحجب نطاقها**. لكنه يبقى شرطاً واجب إغلاقه **قبل** أي session تربط الـ frontend بالـ `GET /financial-summary`. مُسجّل ومُحال لصاحب wiring الـ Finance.
- تعديل منطق `payments` القائم (create/delete/summary الحالي) — خارج النطاق إلا لو قرار ACCOUNTANT-access (اكتشاف #2) فرض تعديل `ensureProjectAccess`؛ وقتها يُرفع صراحة في الـ plan.
- Retention release job / cron أو أي أتمتة زمنية للضمان — خارج النطاق (الحساب read-only per-request فقط).
- Multi-currency / تحويل عملات — خارج النطاق (EGP فقط، تبع الشركة).
- تعديلات الـ BOQ الجماعية (bulk import / Excel) — خارج النطاق.

---

## تعريف النجاح (مبدئي — يُفصَّل في الـ plan)
- [ ] 3 models + migration مُطبّقة (Prisma + Supabase) بلا كسر للموجود.
- [ ] 9 endpoints تشتغل بالصلاحيات الصحيحة لكل دور.
- [ ] financial-summary يحسب القيم الـ 5 بـ Decimal صح مقابل مثال رقمي معلوم.
- [ ] audit على كل PATCH للإعدادات + soft-delete BOQ.
- [ ] صفر خطأ tsc جديد فوق baseline.
- [ ] MVT: العدد يُحدَّد في `00-plan.md` (≥6 من تعداد الـ services أعلاه).

---
⏸️ AWAITING APPROVAL — رد بـ "approve" للانتقال للمخطط (🧠 00-plan.md)، أو "edit: [تعديل]".

✋ تم الـ Scope — للدور التالي؟
