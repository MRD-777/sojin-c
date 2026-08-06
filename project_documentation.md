# 🏗️ مشروع إدارة مشاريع المقاولات والتشطيبات — SaaS

## التوثيق النهائي الشامل — كل ما تم الاتفاق عليه

> **الإصدار**: 1.0 Final  
> **التاريخ**: 2026-04-11  
> **الحالة**: ✅ معتمد — جاهز للتنفيذ

---

# الفهرس

1. [نظرة عامة على النظام](#1-نظرة-عامة-على-النظام)
2. [الهندسة المعمارية](#2-الهندسة-المعمارية)
3. [التقنيات المستخدمة](#3-التقنيات-المستخدمة)
4. [الكيانات والعلاقات](#4-الكيانات-والعلاقات)
5. [نظام الأدوار والصلاحيات](#5-نظام-الأدوار-والصلاحيات)
6. [سير العمل (Workflows)](#6-سير-العمل)
7. [نظام المواعيد والتتبع](#7-نظام-المواعيد-والتتبع)
8. [نظام الشات](#8-نظام-الشات)
9. [نظام الإشعارات](#9-نظام-الإشعارات)
10. [الأمان](#10-الأمان)
11. [Offline Support](#11-offline-support)
12. [تخزين الوسائط](#12-تخزين-الوسائط)
13. [أداء قاعدة البيانات](#13-أداء-قاعدة-البيانات)
14. [Analytics Dashboard](#14-analytics-dashboard)
15. [هيكل المشروع](#15-هيكل-المشروع)
16. [خارطة طريق التنفيذ](#16-خارطة-طريق-التنفيذ)

---

# 1. نظرة عامة على النظام

## الفكرة

نظام **SaaS Multi-tenant** لإدارة ومتابعة مشاريع المقاولات والتشطيبات. يربط بين ثلاثة أطراف: **الشركة** (الإدارة)، **الموظفين** (المهندسين والعمال والمحاسبين)، و**العملاء** (أصحاب المشاريع).

## الأهداف

| الهدف | كيف يتحقق |
|---|---|
| تقليل الخلافات | كل شيء موثق بصور وتقارير وأرقام |
| زيادة الشفافية | العميل يرى كل التحديثات المعتمدة + التكاليف **التفصيلية** |
| التواصل الموثّق | شات داخل النظام — لا حاجة لـ WhatsApp أو مكالمات |
| الالتزام بالمواعيد | نظام مواعيد تسليم يومية مع إشعارات تأخير تلقائية |
| الحماية القانونية | سجل مراجعة (Audit Trail) لكل عملية + لا حذف أبدًا |

## المبادئ الأساسية

1. **لا حذف بيانات نهائيًا** — كل شيء Soft Delete
2. **كل شيء موثّق** — Audit Trail لكل عملية حساسة
3. **العزل التام** — كل شركة (Tenant) معزولة بـ RLS
4. **الأمان أولاً** — Enterprise-grade security على 6 طبقات
5. **التحديث الفوري** — أي تعديل أو إلغاء يظهر لحظيًا لكل المعنيين

---

# 2. الهندسة المعمارية

## الفصل الكامل بين الطبقات

```
┌──────────────────────────────────────────────────────┐
│                    🌐 CDN (Cloudflare)                │
│           WAF + DDoS Protection + Caching            │
└────────────────────┬─────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────┴────────┐   ┌───────────┴────────────┐
│  🖥️ Frontend   │   │    ⚡ Backend (API)     │
│   (Next.js)    │   │      (NestJS)          │
│                │   │                        │
│  • UI/UX       │   │  • Business Logic      │
│  • Pages       │   │  • Auth Guards         │
│  • Components  │   │  • Validation          │
│  • State Mgmt  │   │  • File Processing     │
│  • i18n        │   │  • Notifications       │
│                │   │  • WebSocket Server    │
│  Hosted on:    │   │                        │
│  Vercel        │   │  Hosted on:            │
│                │   │  Railway / Fly.io      │
└───────┬────────┘   └──────┬─────────────────┘
        │                    │
        │            ┌───────┴───────────────────────┐
        │            │                               │
        │    ┌───────┴──────┐  ┌──────────────────┐  │
        │    │ 🐘 PostgreSQL│  │  ⚡ Redis         │  │
        │    │  (Supabase)  │  │  (Cache + Queue)  │  │
        │    │              │  │                   │  │
        │    │  • RLS       │  │  • Caching        │  │
        │    │  • Data      │  │  • BullMQ Jobs    │  │
        │    │  • Auth      │  │  • Sessions       │  │
        │    └──────────────┘  └───────────────────┘  │
        │            │                               │
        │    ┌───────┴──────┐  ┌──────────────────┐  │
        │    │ 📦 Storage   │  │ 📡 Realtime      │  │
        │    │  (Supabase)  │  │  (Supabase)      │  │
        │    │              │  │                   │  │
        │    │  • Images    │  │  • Chat           │  │
        │    │  • Videos    │  │  • Notifications  │  │
        │    │  • Documents │  │  • Live Updates   │  │
        │    └──────────────┘  └───────────────────┘  │
        │                                            │
        └────────────────────────────────────────────┘
```

## لماذا الفصل؟

| السبب | الشرح |
|---|---|
| **Scalability** | كل جزء يتوسع مستقلًا |
| **Security** | الـ Frontend لا يتصل بقاعدة البيانات مباشرة أبدًا |
| **Mobile Ready** | نفس الـ API يخدم الويب والموبايل مستقبلاً |
| **Team Work** | فرق Frontend و Backend تعمل بشكل مستقل |
| **Maintenance** | تعديل الـ UI لا يؤثر على المنطق |

---

# 3. التقنيات المستخدمة

## Frontend

| التقنية | الغرض | لماذا هي ؟ |
|---|---|---|
| **Next.js 15** | Framework | SSR + SSG + App Router + SEO + Image Optimization — أكبر نظام بيئي |
| **TypeScript** | اللغة | Type Safety يمنع 30%+ من الأخطاء — ضروري لمشروع كبير |
| **Tailwind CSS v4** | التصميم | سرعة تطوير + حجم صغير + RTL support ممتاز |
| **shadcn/ui + Radix** | المكونات | Accessible + Customizable + Headless — تحكم كامل |
| **Zustand** | إدارة الحالة | بسيط وسريع — بدون تعقيد Redux |
| **TanStack Query** | جلب البيانات | Caching ذكي + Optimistic Updates + Retry تلقائي |
| **React Hook Form + Zod** | النماذج | أداء عالي 3x أسرع من Formik + Validation قوي |
| **next-intl** | الترجمة | مدمج مع Next.js App Router — عربي + إنجليزي |
| **Recharts** | الرسوم البيانية | مبني لـ React — سهل + Responsive |

## Backend

| التقنية | الغرض | لماذا هي ؟ |
|---|---|---|
| **NestJS** | Framework | بنية Enterprise-grade جاهزة — Modular + DI + Guards + Interceptors |
| **TypeScript** | اللغة | Type Safety + مشاركة Types مع Frontend |
| **Prisma** | ORM | Type-safe queries + Auto types + Migration system |
| **BullMQ** | الطوابير | جدولة مهام + معالجة غير متزامنة + Retry — مبني على Redis |
| **Sharp** | معالجة الصور | ضغط وقص — 5-10x أسرع من البدائل |
| **Resend** | البريد | DX ممتاز + Templates + أرخص |
| **Jest + Supertest** | الاختبارات | مدمج مع NestJS |

## البنية التحتية

| التقنية | الغرض | لماذا هي ؟ |
|---|---|---|
| **PostgreSQL (Supabase)** | قاعدة البيانات | RLS + JSONB + الأقوى في الأمان |
| **Supabase Auth** | المصادقة | JWT + MFA + RLS Integration — مدقّق أمنيًا |
| **Supabase Storage** | تخزين الملفات | مدمج + RLS على الملفات + CDN |
| **Supabase Realtime** | الوقت الحقيقي | Chat + Notifications + Live Updates |
| **Redis** | Cache + Queue | سرعة فائقة — يعمل كـ cache + queue + pub/sub |
| **Cloudflare** | CDN + أمان | WAF + DDoS Protection + CDN — مجاني |
| **Vercel** | استضافة Frontend | Serverless + Edge + Auto-scaling |
| **Railway** | استضافة Backend | سهل + Auto-scaling + PostgreSQL support |
| **Turborepo** | Monorepo | Build caching + Parallel execution |
| **GitHub Actions** | CI/CD | مجاني + مدمج مع GitHub |
| **Sentry** | مراقبة الأخطاء | Error + Performance monitoring |

---

# 4. الكيانات والعلاقات

## 4.1 Company (الشركة)

```
الكيان الجذري — كل شيء في النظام ينتمي لشركة
```

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف الفريد |
| `name` | String | اسم الشركة |
| `slug` | String (unique) | للروابط الفريدة |
| `logo` | URL | شعار الشركة |
| `phone` | String | رقم التواصل |
| `email` | String | البريد الرسمي |
| `address` | String | العنوان |
| `subscription_plan` | Enum: `basic`, `pro`, `enterprise` | خطة الاشتراك |
| `subscription_status` | Enum: `active`, `expired`, `trial` | حالة الاشتراك |
| `storage_quota` | BigInt | حصة التخزين (حسب الخطة) |
| `storage_used` | BigInt | التخزين المستخدم |
| `currency` | String | العملة (EGP, SAR, AED...) |
| `timezone` | String | المنطقة الزمنية |
| `settings` | JSONB | إعدادات مخصصة |
| `created_at` | Timestamp | تاريخ الإنشاء |
| `deleted_at` | Timestamp? | Soft delete |

---

## 4.2 User (المستخدم)

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف الفريد |
| `company_id` | FK → Company | الشركة |
| `name` | String | الاسم الكامل |
| `email` | String (unique/company) | البريد |
| `phone` | String | الهاتف |
| `role` | Enum | الدور الأساسي |
| `custom_permissions` | JSONB | صلاحيات مخصصة (يحددها Super Admin) |
| `specialty` | String? | التخصص (يحدده Super Admin عند الإضافة) |
| `avatar` | URL | الصورة |
| `is_active` | Boolean | فعّال؟ |
| `notification_preferences` | JSONB | تفضيلات الإشعارات (متى + أي قنوات) |
| `preferred_language` | Enum: `ar`, `en` | اللغة المفضلة |
| `last_login` | Timestamp | آخر دخول |
| `created_at` | Timestamp | تاريخ الإنشاء |
| `deleted_at` | Timestamp? | Soft delete |

**ما يمكن للعميل فعله:**
- ✅ متابعة المشروع ورؤية التحديثات المعتمدة
- ✅ رؤية التكاليف **التفصيلية** (مش ملخص — كل بند بتكلفته)
- ✅ إضافة تعليقات على التحديثات
- ✅ طلب مراجعة على تفاصيل يومية
- ✅ طلب تغيير (Change Request)
- ✅ فتح شات مباشر مع أي فرد في الفريق (مهندس / محاسب / مدير)

---

## 4.3 Project (المشروع)

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف الفريد |
| `company_id` | FK → Company | الشركة المالكة |
| `client_id` | FK → User | العميل |
| `name` | String | اسم المشروع |
| `description` | Text | الوصف |
| `location` | String | الموقع |
| `type` | Enum | تشطيب كامل / جزئي / إنشائي |
| `status` | Enum | `draft`, `in_progress`, `on_hold`, `completed`, `cancelled` |
| `start_date` | Date | تاريخ البدء |
| `expected_end_date` | Date | التاريخ المتوقع |
| `actual_end_date` | Date? | التاريخ الفعلي |
| `total_budget` | Decimal | الميزانية |
| `overall_progress` | Int (0-100) | نسبة الإنجاز (محسوبة تلقائيًا) |
| `daily_update_deadline` | Time | الموعد اليومي لتسليم التحديثات |
| `created_at` | Timestamp | تاريخ الإنشاء |
| `deleted_at` | Timestamp? | Soft delete |

---

## 4.4 ProjectAssignment (تعيين الموظفين)

```
جدول ربط Many-to-Many بين المشروع والموظفين
```

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `project_id` | FK → Project | المشروع |
| `user_id` | FK → User | الموظف |
| `role_in_project` | Enum | `site_engineer`, `supervisor`, `accountant`, `worker`, `foreman` |
| `is_required_daily_update` | Boolean | مطلوب منه تحديث يومي؟ |
| `assigned_at` | Timestamp | تاريخ التعيين |
| `removed_at` | Timestamp? | تاريخ الإزالة |

---

## 4.5 Phase (مرحلة المشروع)

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `project_id` | FK → Project | المشروع |
| `name` | String | اسم المرحلة (كهرباء، سباكة...) |
| `description` | Text | الوصف |
| `order` | Integer | الترتيب |
| `weight` | Integer | الوزن في حساب الإنجاز الكلي |
| `status` | Enum | `not_started`, `in_progress`, `completed`, `on_hold` |
| `progress` | Int (0-100) | نسبة الإنجاز (محسوبة + قابلة للتعديل) |
| `start_date` | Date | البدء |
| `expected_end_date` | Date | التاريخ المتوقع |
| `budget` | Decimal | الميزانية |
| `actual_cost` | Decimal | التكلفة الفعلية |
| `created_at` | Timestamp | الإنشاء |
| `deleted_at` | Timestamp? | Soft delete |

---

## 4.6 Update (التحديث اليومي) — قلب النظام

```
كل موظف معيّن على المشروع ومطلوب منه تحديث يومي يرسل تحديثه
(مهندس الموقع يرسل تحديث، المحاسب يرسل تحديث، المشرف يرسل تحديث...)
```

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `phase_id` | FK → Phase | المرحلة |
| `submitted_by` | FK → User | الموظف المرسل |
| `reviewed_by` | FK → User? | المراجع |
| `title` | String | عنوان مختصر |
| `description` | Text | وصف تفصيلي |
| `work_done` | Text | ما تم إنجازه |
| `work_remaining` | Text | المتبقي |
| `workers_count` | Integer | عدد العمال |
| `work_hours` | Decimal | ساعات العمل |
| `materials_used` | JSONB | المواد: `[{name, quantity, unit, cost}]` |
| `cost` | Decimal | التكلفة |
| `progress_increment` | Integer | نسبة التقدم المضافة |
| `status` | Enum | `draft`, `pending`, `approved`, `rejected`, `force_cancelled` |
| `rejection_reason` | Text? | سبب الرفض |
| `force_cancel_reason` | Text? | سبب الإلغاء القسري |
| `force_cancelled_by` | FK → User? | من ألغى قسريًا |
| `is_locked` | Boolean | مقفل بعد 24 ساعة؟ |
| `locked_at` | Timestamp? | وقت القفل |
| `submitted_at` | Timestamp | وقت الإرسال |
| `reviewed_at` | Timestamp? | وقت المراجعة |
| `deleted_at` | Timestamp? | Soft delete |

---

## 4.7 Media (الوسائط)

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `update_id` | FK → Update | التحديث |
| `type` | Enum | `image`, `video`, `document` |
| `url` | URL | رابط الملف |
| `thumbnail_url` | URL? | صورة مصغرة |
| `file_size` | Integer | الحجم بعد الضغط |
| `original_file_size` | Integer | الحجم الأصلي |
| `mime_type` | String | نوع الملف |
| `caption` | String? | وصف |
| `order` | Integer | ترتيب |
| `uploaded_at` | Timestamp | وقت الرفع |

---

## 4.8 Payment (المدفوعات)

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `project_id` | FK → Project | المشروع |
| `amount` | Decimal | المبلغ |
| `type` | Enum | `client_payment`, `expense`, `sunk_cost` |
| `method` | Enum | `cash`, `bank_transfer`, `check`, `other` |
| `description` | Text | الوصف |
| `date` | Date | التاريخ |
| `receipt_url` | URL? | صورة الإيصال |
| `recorded_by` | FK → User | من سجل |
| `created_at` | Timestamp | التسجيل |
| `deleted_at` | Timestamp? | Soft delete |

> العميل يرى التكاليف **التفصيلية** — كل بند بتكلفته، مش مجرد ملخص.

---

## 4.9 Notification (الإشعارات)

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `user_id` | FK → User | المستلم |
| `type` | Enum | نوع الإشعار (انظر أدناه) |
| `title` | String | العنوان |
| `body` | Text | المحتوى |
| `reference_type` | String | نوع المرجع |
| `reference_id` | UUID | ID المرجع |
| `priority` | Enum | `low`, `normal`, `high`, `urgent` |
| `channel` | Enum | `in_app`, `push`, `email`, `sms` |
| `is_read` | Boolean | قُرئ؟ |
| `scheduled_for` | Timestamp? | وقت الإرسال المجدول |
| `created_at` | Timestamp | الإنشاء |

---

## 4.10 ChatRoom + ChatParticipant + ChatMessage

### ChatRoom

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `project_id` | FK → Project | المشروع |
| `type` | Enum | `direct` (1-1), `group` |
| `name` | String? | اسم المجموعة |
| `created_by` | FK → User | المنشئ |
| `created_at` | Timestamp | الإنشاء |

### ChatParticipant

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `room_id` | FK → ChatRoom | الغرفة |
| `user_id` | FK → User | المشارك |
| `joined_at` | Timestamp | الانضمام |
| `last_read_at` | Timestamp | آخر قراءة |

### ChatMessage

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `room_id` | FK → ChatRoom | الغرفة |
| `sender_id` | FK → User | المرسل |
| `content` | Text | المحتوى |
| `type` | Enum | `text`, `image`, `file`, `voice` |
| `attachment_url` | URL? | المرفق |
| `is_read` | Boolean | قُرئت؟ |
| `created_at` | Timestamp | الإرسال |
| `deleted_at` | Timestamp? | Soft delete |

---

## 4.11 Comment (التعليقات)

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `update_id` | FK → Update | التحديث |
| `user_id` | FK → User | الكاتب |
| `content` | Text | المحتوى |
| `type` | Enum | `comment`, `review_request`, `change_request` |
| `status` | Enum? | `open`, `acknowledged`, `resolved` |
| `parent_id` | FK → Comment? | للردود المتسلسلة |
| `created_at` | Timestamp | الإنشاء |
| `deleted_at` | Timestamp? | Soft delete |

---

## 4.12 SubContractor (مقاول باطن)

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `company_id` | FK → Company | الشركة |
| `name` | String | الاسم |
| `specialty` | String | التخصص |
| `phone` | String | الهاتف |
| `email` | String? | البريد |
| `rating` | Decimal (1-5) | التقييم |
| `total_projects` | Integer | عدد المشاريع |
| `notes` | Text? | ملاحظات |
| `joined_at` | Timestamp | تاريخ انضمامه للشركة |
| `created_at` | Timestamp | الإنشاء |
| `deleted_at` | Timestamp? | Soft delete |

### PhaseSubContractor

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `phase_id` | FK → Phase | المرحلة |
| `sub_contractor_id` | FK → SubContractor | المقاول |
| `agreed_cost` | Decimal | التكلفة المتفق عليها |
| `actual_cost` | Decimal | التكلفة الفعلية |
| `status` | Enum | `active`, `completed`, `terminated` |
| `assigned_at` | Timestamp | التعيين |

---

## 4.13 AuditLog (سجل المراجعة)

```
Append-only — لا يُحذف ولا يُعدّل أبدًا
```

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `company_id` | FK → Company | الشركة |
| `user_id` | FK → User | من قام بالعملية |
| `user_role` | String | وظيفته وقت العملية |
| `entity_type` | String | نوع الكيان |
| `entity_id` | UUID | ID الكيان |
| `action` | Enum | `create`, `update`, `delete`, `approve`, `reject`, `force_cancel`, `progress_override` |
| `old_values` | JSONB | القيم القديمة |
| `new_values` | JSONB | القيم الجديدة |
| `reason` | Text? | السبب (مطلوب في العمليات الحساسة) |
| `ip_address` | String | IP |
| `user_agent` | String | المتصفح |
| `created_at` | Timestamp | الوقت |

---

## 4.14 UpdateVersion (إصدارات التحديث)

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `update_id` | FK → Update | التحديث الأصلي |
| `version_number` | Integer | رقم الإصدار |
| `snapshot` | JSONB | نسخة كاملة من البيانات |
| `changed_by` | FK → User | من عدّل |
| `change_reason` | Text? | السبب |
| `created_at` | Timestamp | الوقت |

---

## 4.15 DailyUpdateTracker (متتبع المواعيد)

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | UUID | المعرف |
| `project_id` | FK → Project | المشروع |
| `user_id` | FK → User | الموظف |
| `date` | Date | التاريخ |
| `deadline` | Time | الموعد |
| `status` | Enum | `pending`, `submitted_on_time`, `submitted_late`, `missed` |
| `submitted_at` | Timestamp? | وقت التسليم الفعلي |
| `delay_minutes` | Integer? | دقائق التأخير |
| `notification_sent_to_admin` | Boolean | هل تم إبلاغ المدير؟ |

---

## خريطة العلاقات

```
Company 1──∞ User
Company 1──∞ Project
Company 1──∞ SubContractor

Project ∞──1 User (client)
Project 1──∞ Phase
Project 1──∞ Payment
Project 1──∞ ProjectAssignment
Project 1──∞ ChatRoom
Project 1──∞ DailyUpdateTracker

ProjectAssignment ∞──1 User
ProjectAssignment ∞──1 Project

Phase 1──∞ Update
Phase 1──∞ PhaseSubContractor

SubContractor 1──∞ PhaseSubContractor

Update 1──∞ Media
Update 1──∞ Comment
Update 1──∞ UpdateVersion
Update ∞──1 User (submitted_by)
Update ∞──1 User (reviewed_by)

Comment ∞──1 User
Comment ∞──1 Comment (parent - self-referencing)

ChatRoom 1──∞ ChatParticipant
ChatRoom 1──∞ ChatMessage
ChatParticipant ∞──1 User
ChatMessage ∞──1 User (sender)

Notification ∞──1 User
AuditLog ∞──1 User
AuditLog ∞──1 Company
```

---

# 5. نظام الأدوار والصلاحيات

## الأدوار

| الدور | الرمز | الوصف |
|---|---|---|
| 🔴 **Super Admin** | `super_admin` | مالك الشركة — كل الصلاحيات |
| 🟠 **Project Manager** | `project_manager` | مدير مشاريع — إدارة + مراجعة |
| 🟢 **Site Engineer** | `site_engineer` | مهندس موقع — تحديثات + تعليقات |
| 🟢 **Supervisor** | `supervisor` | مشرف — تحديثات + تعليقات |
| 🟡 **Accountant** | `accountant` | محاسب — مدفوعات + تحديثات مالية |
| 🔵 **Worker** | `worker` | عامل — تحديثات بسيطة + صور |
| ⚪ **Client** | `client` | عميل — قراءة + تعليق + شات |

## إدارة الأدوار

**السوبر أدمن عند إضافة أي موظف يحدد:**
1. الدور الأساسي (من القائمة أعلاه)
2. التخصص (كهرباء، سباكة، نقاشة، محاسبة...)
3. صلاحيات مخصصة إضافية (اختياري)

**يمكنه تعديل كل ذلك لاحقًا في أي وقت**

## مصفوفة الصلاحيات

| الإجراء | Super Admin | Project Mgr | Engineer | Supervisor | Accountant | Worker | Client |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| إدارة الشركة | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| إدارة المستخدمين | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| إنشاء مشروع | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| تعيين موظفين | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| إنشاء مراحل | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| رفع تحديث يومي | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| مراجعة واعتماد | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| رفض تحديث | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| إلغاء قسري | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| تعديل نسب الإنجاز | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| تسجيل مدفوعات | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| رؤية التكاليف التفصيلية | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| تعديل تحديث معتمد (24h) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| تعليقات | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| طلب مراجعة/تغيير | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| شات | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Analytics | ✅ | ✅ | ❌ | ❌ | ✅ (مالي) | ❌ | ❌ |
| Audit Log | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| حذف حساب موظف (remote wipe) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## نظام الصلاحيات المخصصة (Permission-Based)

```
الصلاحية = resource.action
مثال: projects.create, updates.approve, payments.view_detailed
```

**الموارد والإجراءات:**

| المورد | الإجراءات |
|---|---|
| `company` | `view`, `edit`, `manage_settings`, `manage_users`, `manage_billing` |
| `projects` | `view`, `create`, `edit`, `delete`, `assign_members`, `view_analytics` |
| `phases` | `view`, `create`, `edit`, `delete` |
| `updates` | `view_own`, `view_all`, `create`, `edit_draft`, `submit`, `approve`, `reject`, `force_cancel`, `edit_approved` |
| `payments` | `view_summary`, `view_detailed`, `create`, `edit` |
| `media` | `view`, `upload`, `delete` |
| `comments` | `view`, `create`, `create_review_request`, `create_change_request` |
| `chat` | `view`, `send`, `create_room` |
| `sub_contractors` | `view`, `create`, `edit`, `assign` |
| `audit_log` | `view` |
| `analytics` | `view_all`, `view_financial`, `view_performance` |
| `users` | `view`, `create`, `edit`, `deactivate`, `remote_wipe` |

**السوبر أدمن يمكنه إنشاء أدوار مخصصة** — مثلاً:
- "مهندس أول" = مهندس + `updates.approve`
- "محاسب متقدم" = محاسب + `analytics.view_all`

---

# 6. سير العمل (Workflows)

## 6.1 دورة حياة التحديث

```
[الموظف يحفظ مسودة]
        │
        ▼
    ┌─ DRAFT ─┐
    │         │
    │  يعدّل  │
    │ ويكمل  │
    └────┬────┘
         │ يرسل للمراجعة
         ▼
    ┌─ PENDING ─┐
    │           │
    ├───────────┼──────────────────────┐
    │           │                      │
    ▼           ▼                      ▼
APPROVED    REJECTED              (SLA breach)
    │           │                 إشعار تذكير
    │           │                 للمراجع
    │           ▼
    │     يرجع DRAFT
    │     (الموظف يعدّل
    │      ويرسل مجددًا)
    │
    ├── خلال 24 ساعة ──→ الأدمن يمكنه التعديل + إشعار العميل
    │
    ├── بعد 24 ساعة ──→ LOCKED (مقفل نهائيًا)
    │
    └── ظرف قهري ──→ FORCE_CANCELLED
                      (Super Admin فقط)
                      + اسم المُلغي
                      + سبب الإلغاء
                      + إشعار العميل
                      + لو في مصاريف → sunk_cost
```

### القواعد الذهبية:

1. **التحديث المرفوض لا يُحذف** — يجب تعديله وإعادة إرساله
2. **الإلغاء القسري** فقط من Super Admin في ظروف قهرية مع توثيق كامل
3. **إذا تم إلغاء تحديث فيه مصاريف**: تُسجّل كـ `sunk_cost` ويُبلّغ العميل والأدمن
4. **بعد 24 ساعة من الموافقة** = مقفل نهائيًا — لا يمكن تعديله
5. **التكلفة تُحسب فقط من التحديثات المعتمدة** (`approved`)
6. **نسبة الإنجاز**: `current_progress + increment ≤ 100`

## 6.2 حساب نسبة الإنجاز

```
Phase Progress = مجموع progress_increment من التحديثات المعتمدة

Project Progress = مجموع (Phase Progress × Phase Weight) / مجموع (Phase Weights)
```

**التعديل اليدوي**: الأدمن يمكنه تعديل نسبة الإنجاز مع:
- ✅ تسجيل في AuditLog
- ✅ اسم المعدّل + وظيفته + السبب (مطلوب)
- ✅ القيمة القديمة والجديدة
- ✅ إشعار للعميل

---

# 7. نظام المواعيد والتتبع

## كيف يعمل يوميًا

```
09:00  بداية اليوم
  │     النظام ينشئ DailyUpdateTracker لكل موظف مطلوب منه تحديث
  │
16:30  قبل الموعد بـ 30 دقيقة (مثلاً الموعد 17:00)
  │     📱 تذكير للموظف: "موعد تسليم التحديث اليومي خلال 30 دقيقة"
  │
17:00  الموعد المحدد
  │     ├── ✅ الموظف سلّم → submitted_on_time
  │     └── ⏰ الموظف لم يسلّم → انتظار
  │
17:30  بعد 30 دقيقة من الموعد
  │     └── 🚨 إشعار عاجل للمدير: "الموظف [اسم] تأخر عن تسليم التحديث"
  │
23:59  نهاية اليوم
        └── لم يسلّم → missed + تسجيل في تقرير الأداء
```

## SLA Tracking

| المقياس | القاعدة |
|---|---|
| تسليم التحديث اليومي | قبل الموعد المتفق عليه مع العميل |
| مراجعة التحديث | خلال X ساعة (قابل للتخصيص) |
| الرد على طلب مراجعة | خلال X ساعة |
| الرد على رسالة شات | خلال X ساعة (ساعات العمل) |

---

# 8. نظام الشات

## كيف يعمل

```
العميل يفتح صفحة الشات
        │
        ▼
  يرى قائمة فريق المشروع:
  ├── 👷 محمد أحمد (مهندس موقع) ── شات مباشر
  ├── 💼 أحمد علي (محاسب) ── شات مباشر
  ├── 👔 خالد محمود (مدير المشروع) ── شات مباشر
  └── 👥 مجموعة المشروع ── شات جماعي
```

**القواعد:**
- كل المحادثات مرتبطة بمشروع
- كل المحادثات موثقة ومحفوظة — لا حذف
- إشعار فوري عند استلام رسالة جديدة
- دعم: نصوص + صور + ملفات + صوت
- العميل يقدر يكلم أي حد في الفريق

---

# 9. نظام الإشعارات

## أنواع الإشعارات

| النوع | المستلم | الأولوية | القناة |
|---|---|---|---|
| تحديث جديد للمراجعة | Admin | Normal | In-App + Push |
| تحديث معتمد | Employee + Client | Normal | In-App + Push + Email |
| تحديث مرفوض | Employee | High | In-App + Push |
| إلغاء قسري | Client + Employee | Urgent | All channels |
| تعديل بعد الموافقة | Client | High | In-App + Push |
| تأخر في تسليم التحديث | Admin | Urgent | In-App + Push |
| دفعة جديدة | Admin + Client | Normal | In-App + Email |
| مرحلة مكتملة | Client + Admin | Normal | In-App + Email |
| رسالة شات جديدة | Target User | Normal | In-App + Push |
| تعليق جديد | Relevant Users | Normal | In-App |
| طلب تغيير من العميل | Admin | High | In-App + Push |
| خرق SLA | Admin | Urgent | In-App + Push + Email |
| إلغاء مرحلة أو تحديث | كل الموظفين على المشروع | Urgent | All channels |

## تفضيلات العميل

العميل يحدد بنفسه:
- **متى يستلم الإشعارات**: فورًا / ملخص يومي / أوقات محددة
- **أي قنوات**: In-App / Push / Email / SMS

## التحديث الفوري (Realtime)

أي تعديل أو إلغاء يظهر **لحظيًا** لكل المعنيين عبر Supabase Realtime:
- إلغاء مرحلة → كل الموظفين يعرفوا فورًا
- تعديل تحديث → العميل يشوف التعديل فورًا
- رسالة شات → تظهر فورًا

---

# 10. الأمان (Enterprise-Grade)

## 6 طبقات حماية

```
الطبقة 1: الشبكة
├── Cloudflare WAF (يمنع SQL Injection, XSS, CSRF)
├── DDoS Protection
├── TLS 1.3 (HTTPS فقط)
└── Security Headers (CSP, HSTS, X-Frame-Options...)

الطبقة 2: المصادقة
├── Supabase Auth (JWT + Refresh Tokens)
├── MFA (إجبارية لـ Super Admin)
├── Brute Force Protection (حظر بعد 5 محاولات)
├── Password Policy (10+ أحرف + أرقام + رموز)
├── Session Management + Token Rotation
└── Device Tracking (تنبيه عند جهاز جديد)

الطبقة 3: التفويض
├── RBAC (Role-Based Access Control)
├── Permission-Based System (صلاحيات دقيقة)
├── Row Level Security - RLS (PostgreSQL)
├── Tenant Isolation (company_id filter)
└── Principle of Least Privilege

الطبقة 4: حماية البيانات
├── Encryption at Rest (AES-256)
├── Encryption in Transit (TLS 1.3)
├── Password Hashing (bcrypt via Supabase)
├── Signed URLs (ملفات محمية بروابط مؤقتة)
├── Input Validation (حجم + نوع + محتوى)
└── SQL Injection Prevention (Parameterized queries + RLS)

الطبقة 5: المراقبة والكشف
├── Audit Trail (كل عملية حساسة مسجلة)
├── Anomaly Detection (أنماط غير طبيعية)
├── Failed Login Monitoring
├── Data Access Logging
└── Real-time Alerts

الطبقة 6: الاستمرارية
├── Daily Automated Backups
├── Point-in-Time Recovery (7 أيام)
├── Multi-Region Backup
└── Disaster Recovery (RTO < 4 ساعات)
```

## Row Level Security (RLS)

```
بدون RLS: SELECT * FROM projects → يرجع كل المشاريع لكل الشركات!
مع RLS:   SELECT * FROM projects → يرجع مشاريع شركتك فقط
```

**كيف؟** سياسات على مستوى قاعدة البيانات — حتى لو في bug في الكود، القاعدة ترفض إرجاع بيانات شركات أخرى.

## Remote Wipe (حذف عن بُعد)

Super Admin يمكنه:
- حذف حساب موظف بكل بياناته المحلية
- مفيد لو: جهاز الموظف اتسرق / الموظف طلع من الشركة
- الحذف يشمل: Sessions + Local Storage + Cached Data

---

# 11. Offline Support

## المرحلة الأولى (اللي هنبدأ بيها)

```
1. الموظف يفتح صفحة التحديث
2. يكتب التحديث + يرفع صور → كل شيء يُحفظ محليًا (IndexedDB)
3. الصور تُضغط تلقائيًا في المتصفح (5MB → ~500KB)
4. عند عودة الاتصال → Background Sync يرفع كل شيء تلقائيًا
5. إشعار: "تم مزامنة تحديثاتك بنجاح ✅"
```

## حل مشكلة التعارضات

**القاعدة: شخص واحد فقط يرفع كل نوع تحديث في كل مرحلة.**

كل موظف مسؤول عن نوع تحديث محدد (المهندس يرفع تحديث المهندس، المحاسب يرفع تحديث المحاسب) — فلا يوجد تعارض.

## حل مشكلة البيانات القديمة

1. عند إلغاء أي مرحلة أو تحديث → كل الموظفين يتبلّغوا **فورًا**
2. عند عودة الاتصال → النظام يتحقق:
   - التاريخ الحالي vs تاريخ المحفوظ
   - لو عدّى فترة السماح → يُبلّغ الموظف: "البيانات قديمة — أعد الإدخال"
   - لو المرحلة اتلغت → يُبلّغ الموظف ويُلغي الرفع

## حل مشكلة حجم التخزين المحلي

- حفظ النصوص فقط محليًا (حجمها صغير جدًا)
- الصور تُضغط بشدة قبل التخزين المحلي
- حد أقصى للتخزين المحلي (50MB مثلاً)
- أقدم المسودات تُحذف تلقائيًا لتوفير المساحة

## تشفير البيانات المحلية

- كل البيانات المحلية مشفرة (AES)
- لو الجهاز اتسرق: قفل الجهاز + التشفير + Remote Wipe = حماية كاملة

---

# 12. تخزين الوسائط

## خطط التخزين (التسعير على العميل/الشركة)

| الخطة | المساحة | مناسبة لـ |
|---|---|---|
| **Basic** | 10 GB | 2-3 مشاريع صغيرة |
| **Pro** | 50 GB | 5-10 مشاريع متوسطة |
| **Enterprise** | 200 GB | مشاريع كبيرة + فيديو |
| **Custom** | حسب الطلب | شركات عملاقة |

## تحسينات التخزين

| التحسين | التفاصيل |
|---|---|
| ضغط الصور تلقائيًا | WebP/AVIF بجودة 85% → وفر 60-70% |
| أحجام متعددة | Thumbnail 150px + Medium 800px + Full |
| ضغط الفيديو | H.265 + دقة محددة → وفر 50-60% |
| Deduplication | كشف الملفات المكررة → وفر 10-15% |
| Cold Storage | مشاريع مكتملة > 6 أشهر → تخزين أرخص بـ 60% |
| CDN Caching | تسريع التحميل 3-5x |
| Lazy Loading | تحميل الصور عند الحاجة فقط |
| Progressive Loading | صورة ضبابية أولاً ثم التفاصيل |
| Client-side Compression | ضغط في المتصفح قبل الرفع |

## مؤشر الاستهلاك

```
Dashboard الأدمن:
██████████░░░░░░░░░░ 52% (26GB / 50GB)
⚠️ تنبيه عند 80%
🚨 تنبيه عند 95%
```

---

# 13. أداء قاعدة البيانات

## Indexes

| Index | الأعمدة | السبب |
|---|---|---|
| Tenant Filter | `company_id` (كل الجداول) | كل query يفلتر بالشركة |
| Update Lookup | `(company_id, phase_id, status)` | الاستعلام الأكثر تكرارًا |
| Project Status | `(company_id, status, created_at)` | لوحة المشاريع |
| Timeline | `(phase_id, submitted_at DESC)` | التايملاين |
| Chat Messages | `(room_id, created_at DESC)` | تحميل الرسائل |
| Notifications | `(user_id, is_read, created_at DESC)` | عداد الإشعارات |
| Full Text | GIN on `description, work_done` | بحث نصي |

## تحسينات الأداء

| الاستراتيجية | الشرح |
|---|---|
| **Materialized Views** | الإحصائيات تُحدّث كل 5 دقائق بدل الحساب في كل request |
| **Computed Columns** | `overall_progress` يُحفظ ويُحدّث عند التغيير |
| **Cursor-based Pagination** | بدل OFFSET/LIMIT البطيء |
| **Connection Pooling** | PgBouncer لإدارة الاتصالات |
| **Read Replicas** | نسخة قراءة للتقارير والاستعلامات الثقيلة |

## Caching (Redis)

| البيانات | مدة الـ Cache |
|---|---|
| بيانات المشروع | 5 دقائق |
| صلاحيات المستخدم | 15 دقيقة |
| آخر التحديثات | 1 دقيقة |
| الإحصائيات | 5 دقائق |
| إشعارات غير مقروءة | 30 ثانية |
| بيانات الشركة | 30 دقيقة |

## Table Partitioning (بالشهر)

- `updates` — الجدول الأكبر
- `audit_log` — ينمو بسرعة (append-only)
- `notifications` — كثير جدًا
- `chat_messages` — ينمو بسرعة

## Archiving

```
المشاريع المكتملة > 12 شهر:
→ وسائط → Cold Storage (أرخص 60%)
→ تحديثات → Archive Tables
→ البيانات الأساسية تبقى
→ كل شيء متاح من صفحة "الأرشيف"
```

---

# 14. Analytics Dashboard

| المقياس | المستلم |
|---|---|
| متوسط وقت إنجاز المشروع (حسب النوع) | Admin |
| معدل التأخير (نسبة المشاريع المتأخرة) | Admin |
| تكلفة الانحراف (ميزانية vs فعلي) | Admin + Accountant |
| أداء الموظفين (التزام + معدل موافقة) | Admin |
| تقرير مقاولي الباطن (أداء + تقييم) | Admin |
| تقرير مالي (إيرادات vs مصروفات) | Admin + Accountant |
| تقدم المشاريع (تايملاين + نسب + صور) | Client |
| SLA Compliance | Admin |

---

# 15. هيكل المشروع

```
saas-one/
├── packages/
│   ├── shared-types/            # TypeScript types مشتركة
│   └── shared-utils/            # دوال مساعدة مشتركة
│
├── apps/
│   ├── web/                     # Frontend (Next.js 15)
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   │   ├── [locale]/   # i18n routing
│   │   │   │   │   ├── (auth)/        # Login, Register
│   │   │   │   │   ├── (dashboard)/   # Main app
│   │   │   │   │   │   ├── projects/
│   │   │   │   │   │   ├── updates/
│   │   │   │   │   │   ├── chat/
│   │   │   │   │   │   ├── payments/
│   │   │   │   │   │   ├── analytics/
│   │   │   │   │   │   ├── settings/
│   │   │   │   │   │   └── notifications/
│   │   │   │   │   └── (client)/      # Client portal
│   │   │   ├── components/
│   │   │   │   ├── ui/         # shadcn/ui components
│   │   │   │   ├── layout/     # Layout components
│   │   │   │   └── features/   # Feature-specific components
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── lib/            # Utilities + API client
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── styles/         # Global styles
│   │   │   └── i18n/           # Translations (ar/en)
│   │   │       ├── ar/
│   │   │       └── en/
│   │   ├── public/
│   │   └── next.config.ts
│   │
│   └── api/                     # Backend (NestJS)
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── companies/
│       │   │   ├── users/
│       │   │   ├── projects/
│       │   │   ├── phases/
│       │   │   ├── updates/
│       │   │   ├── media/
│       │   │   ├── payments/
│       │   │   ├── chat/
│       │   │   ├── comments/
│       │   │   ├── notifications/
│       │   │   ├── sub-contractors/
│       │   │   ├── analytics/
│       │   │   ├── audit/
│       │   │   └── admin/
│       │   ├── common/
│       │   │   ├── guards/          # Auth + Role + Permission guards
│       │   │   ├── decorators/      # @Roles, @Permissions, @CurrentUser
│       │   │   ├── filters/         # Exception handling
│       │   │   ├── interceptors/    # Logging, Transformation, Audit
│       │   │   ├── pipes/           # Validation
│       │   │   └── middleware/      # Tenant isolation
│       │   ├── config/
│       │   └── prisma/              # Prisma client + schema
│       ├── prisma/
│       │   ├── schema.prisma        # Database schema
│       │   └── migrations/          # Migration files
│       └── test/
│
├── supabase/
│   ├── migrations/                  # SQL migrations (RLS policies)
│   ├── functions/                   # Edge Functions
│   └── config.toml
│
├── docker-compose.yml               # Local dev (Redis, etc.)
├── turbo.json                        # Turborepo config
├── .github/
│   └── workflows/                   # CI/CD
└── package.json
```

---

# 16. خارطة طريق التنفيذ

## المرحلة 1: الأساس (MVP) — 6-8 أسابيع

| # | المهمة | الأولوية |
|---|---|---|
| 1 | إعداد المشروع (Monorepo + Next.js + NestJS + Prisma) | 🔴 |
| 2 | تصميم قاعدة البيانات + Migrations + RLS | 🔴 |
| 3 | نظام المصادقة (Supabase Auth) | 🔴 |
| 4 | إدارة الشركات + المستخدمين + الأدوار | 🔴 |
| 5 | إدارة المشاريع + المراحل | 🔴 |
| 6 | نظام التحديثات (Draft → Pending → Approved/Rejected) | 🔴 |
| 7 | رفع الصور مع الضغط التلقائي | 🔴 |
| 8 | Dashboard العميل (قراءة + تعليق) | 🔴 |
| 9 | الإشعارات الأساسية (In-App) | 🟡 |
| 10 | Audit Trail | 🟡 |

## المرحلة 2: التوسع — 4-6 أسابيع

| # | المهمة |
|---|---|
| 11 | نظام المدفوعات والتكاليف |
| 12 | نظام المواعيد والتتبع (Deadlines + SLA) |
| 13 | نظام الشات |
| 14 | طلبات المراجعة والتغيير |
| 15 | Push Notifications + Email |
| 16 | رفع فيديوهات + ضغط |
| 17 | Document Versioning |

## المرحلة 3: النضج — 4-6 أسابيع

| # | المهمة |
|---|---|
| 18 | مقاولي الباطن |
| 19 | Analytics Dashboard |
| 20 | SLA Tracking متقدم |
| 21 | تقارير PDF |
| 22 | أدوار مخصصة (Permission-based) |
| 23 | Offline Support |

## المرحلة 4: التوسع الكبير

| # | المهمة |
|---|---|
| 24 | تطبيق موبايل (React Native / PWA) |
| 25 | Integration APIs |
| 26 | White-label |
| 27 | AI-powered insights |

---

> **هذا التوثيق النهائي الشامل لكل ما تم الاتفاق عليه. جاهز للتنفيذ.**
