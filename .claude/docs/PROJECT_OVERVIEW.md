# نظرة عامة على المشروع — Construction SaaS

> أول ملف يتقرا لأي حد (أو أي Claude session جديدة) يفتح المشروع ده.
> آخر تحديث: 2026-07-06.

---

## فكرة المشروع

Construction SaaS — منصة تربط شركات المقاولات بعملائها.

---

## المشكلة اللي بتحلها

العميل اللي بيدفع ملايين مش عارف إيه اللي بيحصل في مشروعه إلا لما يروح الموقع بنفسه.
مفيش شفافية، مفيش توثيق، مفيش ثقة.

---

## الحل

نظام رقمي بيخلي:
- الموظفين في الموقع يرفعوا تقرير يومي (صور + تفاصيل + نسبة إنجاز)
- التقرير يتراجع عليه مدير المشروع (approve/reject)
- العميل يتابع كل ده من موبايله في البيت لحظة بلحظة

---

## المستخدمين (7 Roles)

| الدور | الوصف |
|---|---|
| SUPER_ADMIN | صاحب شركة المقاولات، يشوف كل حاجة |
| PROJECT_MANAGER | مدير المشروع، يراجع ويوافق على التقارير |
| SITE_ENGINEER | مهندس الموقع، يرفع التقارير اليومية |
| SUPERVISOR | مشرف، يساعد في رفع التقارير |
| ACCOUNTANT | محاسب، يشوف المدفوعات والماليات |
| WORKER | عامل، يرفع تقارير بسيطة |
| CLIENT | العميل، يتابع مشروعه بس (مش يعدل) |

---

## الـ Stack

| الطبقة | التقنية |
|---|---|
| Frontend | Next.js |
| Backend | NestJS + Prisma + Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Queue | BullMQ + Redis |
| Auth | Supabase Auth + JWT |

---

## القاعدة الذهبية

> لو في شك في أي قرار — الأمان والتوثيق أهم من السرعة.

الأمان والمال هما أهم جزئين في المشروع:
- كل action يتوثق في audit_log ومفيش حاجة تتمسح نهائياً أبداً
- الحسابات المالية تطلع دقيقة 100% من الـ DB مش من أرقام تقديرية

---

## نظام المقايسات والإدارة المالية

### الجداول الجديدة في الـ Database

**1. ProjectFinancialSettings — إعدادات مالية لكل مشروع**

يتملى مرة واحدة في بداية المشروع من SUPER_ADMIN أو ACCOUNTANT.

| الحقل | المعنى | مثال |
|---|---|---|
| contractValue | قيمة العقد الكلية | 1,000,000 ج |
| retentionPct | نسبة الاحتجاز | 5% |
| advanceAmount | قيمة السلفة اللي دفعها العميل | 100,000 ج |
| advancePct | نسبة استرداد السلفة من كل مستخلص | 20% |
| warrantyMonths | فترة الضمان بالشهور | 6 |
| warrantyStartDate | تاريخ بداية الضمان (عند التسليم) | — |

**2. BOQItem — بنود جدول الكميات (شجرة)**

كل بند ممكن يكون فيه تفريعات.

| الحقل | المعنى |
|---|---|
| projectId | المشروع اللي البند ده جزء منه |
| parentId | لو ده تفريعة، id البند الأب (nullable) |
| name | اسم البند |
| contractValue | قيمة البند في العقد |
| order | ترتيب العرض |

مثال على الشجرة:
```
أعمال الهيكل الإنشائي (400,000)   ← بند رئيسي
  ├── حفر وتسوية الأساسات (80,000)
  ├── صب الأساس والخرسانة (150,000)
  ├── بناء الطوابق (100,000)
  └── أعمال السقف (70,000)

أعمال التشطيبات (350,000)          ← بند رئيسي
  ├── دهانات (100,000)
  └── سيراميك وأرضيات (250,000)

أعمال الكهرباء والسباكة (250,000)  ← بند رئيسي
```

**3. BOQItemUpdate — ربط التقارير اليومية بالبنود**

| الحقل | المعنى |
|---|---|
| boqItemId | البند اللي التقرير ده بيخصه |
| updateId | التقرير اليومي المعتمد |

ده بيخلي النظام يحسب نسبة إنجاز كل بند تلقائياً من التقارير المعتمدة.

---

### الـ Endpoints الجديدة

**Financial Settings:**
```
GET   /projects/:id/financial-settings   → جيب الإعدادات
PATCH /projects/:id/financial-settings   → عدّل الإعدادات (كل تعديل في audit_log)
```

**Financial Summary (الأهم — يتحسب real-time):**
```
GET /projects/:id/financial-summary

الحسابات:
totalCompleted   = Σ cost لكل Update بحالة APPROVED
retention        = totalCompleted × retentionPct
advanceRecovered = Min(advanceAmount, totalCompleted × advancePct)
totalPaid        = Σ كل Payments من العميل
netDue           = totalCompleted - retention - advanceRecovered - totalPaid
retentionReleased = warrantyStartDate + warrantyMonths < اليوم
```

**BOQ:**
```
GET    /projects/:id/boq       → شجرة البنود مع نسب الإنجاز
POST   /projects/:id/boq       → بند رئيسي جديد
POST   /boq/:id/sub-items      → تفريعة جديدة تحت بند
PATCH  /boq/:id                → تعديل بند (اسم أو قيمة)
DELETE /boq/:id                → حذف soft (مع الـ audit)
PATCH  /boq/:id/link-update    → ربط تقرير معتمد ببند
```

---

### الصلاحيات

| الـ Endpoint | SUPER_ADMIN | ACCOUNTANT | PROJECT_MANAGER | CLIENT |
|---|:---:|:---:|:---:|:---:|
| financial-settings GET | ✅ | ✅ | ✅ | ❌ |
| financial-settings PATCH | ✅ | ✅ | ❌ | ❌ |
| financial-summary | ✅ | ✅ | ✅ | ✅ (بدون إعدادات) |
| BOQ GET | ✅ | ✅ | ✅ | ✅ |
| BOQ CRUD | ✅ | ✅ | ❌ | ❌ |

---

### قواعد الأمان المالي

- كل تعديل في الإعدادات المالية يتسجل في audit_log (مين؟ من كام لكام؟ امتى؟)
- الأرقام مش بتتخزن — بتتحسب في كل request من الـ DB مباشرة
- netDue مش موجود في الـ DB عشان يمنع أي manipulation
- Soft delete على BOQ — مفيش بند بيتمسح نهائياً

---

### مين بيعمل إيه

**SUPER_ADMIN:**
1. يفتح المشروع الجديد
2. يدخل قيمة العقد + نسبة الاحتجاز + السلفة

**ACCOUNTANT (أو مهندس الكميات):**
1. يضيف بنود الـ BOQ (أعمال الهيكل، التشطيبات، إلخ)
2. يضيف التفريعات تحت كل بند

**SITE_ENGINEER / SUPERVISOR:**
1. يرفع تقرير يومي (زي الأول)
2. يربط التقرير ببند BOQ محدد
3. النظام يحدّث نسبة إنجاز البند تلقائياً

**PROJECT_MANAGER:**
1. يراجع التقارير ويوافق عليها
2. يشوف الـ financial-summary ويعرف المستحق الصافي

**ACCOUNTANT:**
1. يشوف الـ financial-summary الكامل
2. يسجّل الدفعات الواردة من العميل
3. يتابع الاحتجاز والسلفة

**CLIENT:**
1. يشوف نسبة الإنجاز
2. يشوف المستحق الصافي عليه (بدون الإعدادات الداخلية)

---

## ملفات مرجعية

| الملف | الغرض |
|---|---|
| `CLAUDE.md` | نظام الأدوار (Quick/Standard/Deep) + القواعد الثابتة |
| `PLAN.md` | خطة العمل العامة + الأولويات |
| `BACKLOG.md` | كل الـ tickets المفتوحة |
| `BACKEND_REFERENCE_*.md` | مرجع كامل لكل موديول في الـ Backend |
| `INTEGRATION_PLAN.md` | خطة ربط الـ Frontend بالـ Backend |
| `PAGE_WIRING_TRACKER.md` | تتبع حالة كل صفحة (متربطة / لسه لأ) |