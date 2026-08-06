# 📚 التقرير المرجعي الكامل للـ Backend — Construction SaaS

> هذا الملف هو **الفهرس (index)** للتقرير المرجعي الكامل.
> التقرير اتقسّم لـ 5 ملفات منفصلة عشان الحجم (كل ملف يقدر يتقرا لوحده).
> كل المحتوى مبني على **قراءة الكود الفعلي** في `apps/api/src` — مش من ذاكرة عامة.

تاريخ الإنشاء: مبني على آخر حالة للكود في الـ repo (Prisma schema بتاريخ migration 2026-05-30).

---

## 🗺️ خريطة الملفات

| الملف | المحتوى |
|------|---------|
| [BACKEND_REFERENCE_01_auth_users_companies.md](./BACKEND_REFERENCE_01_auth_users_companies.md) | نظرة عامة على الـ Architecture + موديولات: **Auth**، **Users**، **Companies** (+ Audit log service لأنه مستخدم في كل حتة) |
| [BACKEND_REFERENCE_02_projects_phases_updates.md](./BACKEND_REFERENCE_02_projects_phases_updates.md) | موديولات: **Projects**، **Phases**، **Updates** (قلب النظام — state machine + progress calc) |
| [BACKEND_REFERENCE_03_payments_media_comments.md](./BACKEND_REFERENCE_03_payments_media_comments.md) | موديولات: **Payments**، **Media** (+ media-security)، **Comments** |
| [BACKEND_REFERENCE_04_chat_audit_subcontractors.md](./BACKEND_REFERENCE_04_chat_audit_subcontractors.md) | موديولات: **Chat**، **Audit** (controller)، **Sub-Contractors**، **Health** |
| [BACKEND_REFERENCE_05_schema_infra.md](./BACKEND_REFERENCE_05_schema_infra.md) | **Database Schema** كامل + **Cross-cutting** (Guards/Interceptors/Filters/Middleware/Idempotency/Resilience) + **كل الـ Enums** |

---

## 🔢 ملخص بالأرقام

- **13+ موديول** تحت `src/modules/`: auth, audit, companies, users, projects, phases, updates, media, payments, comments, sub-contractors, chat, health.
- **19 model** في `schema.prisma` (17 entity أساسية + UpdateVersion + DailyUpdateTracker + IdempotencyRecord).
- **~11,700 سطر** كود (غير الـ specs).
- أكبر service: `updates.service.ts` (1028 سطر) — قلب النظام.

ابدأ من الملف الأول.
