# Scope — WEB-S4-P7-001: Reviews Inbox project-picker

## Mode: Quick
السبب: استبدال mock ثابت في صفحة واحدة بمنتقي مشاريع حقيقي فوق hook جاهز (`useProjects`) — صفر backend جديد، صفر state machine، صفر أموال. الـ pattern (list → link) منفّذ حرفياً في `projects/page.tsx` كمرجع. دور واحد (المبرمج) يكفي.

## المهمة
`reviews/page.tsx` لسه mock (`ReviewItem` + 3 صفوف ثابتة) — والـ nav entry حيّ فيوريه بيانات وهمية (سبب رفعه MEDIUM في BACKLOG، مُلزِم قبل production). نستبدله بمنتقي مشاريع:
- `useProjects()` → قائمة المشاريع الحقيقية (loading / empty / error states، نفس نمط `projects/page.tsx`).
- كل مشروع → link لـ `dashboard/projects/[id]` **مع فتح تبويب المراجعات مباشرة** (`?tab=reviews`).
- نص توضيحي إن المراجعة per-project (الـ Review Inbox = تبويب داخل detail، مش aggregation عام — قرار S4 المعتمد).

**سبب `?tab=reviews` (نقطة قرار #1):** `detailTab` في `[id]/page.tsx:79` = `useState("phases")` بدون URL sync. بدون تعديل، أي link يهبط على تبويب المراحل مش المراجعات. الحل الأضيق: قراءة `?tab=` كـ **initial state أحادي الاتجاه فقط** (`useSearchParams().get("tab")`) — **مش** bidirectional sync (الكتابة على الـ URL عند تبديل التبويب تظل مؤجّلة، هي "السطح الأكبر" اللي S4 أجّله). لو رفضت الإضافة دي، البديل: المنتقي يودّي لـ `/projects/[id]` (تبويب المراحل الافتراضي) والمستخدم يضغط "مراجعة التحديثات" يدوياً.

## الملفات المتأثرة
- `apps/web/src/app/[locale]/dashboard/projects/reviews/page.tsx` — **rewrite كامل**: حذف الـ mock (`ReviewItem`، `reviewItems`، helpers `getPriority/getSLA/getTypeIcon`) → منتقي مشاريع (`useProjects` + states + links). يحافظ على الـ header/i18n key `nav.projects_reviews`.
- `apps/web/src/app/[locale]/dashboard/projects/[id]/page.tsx` — **تعديل موضعي صغير** (نقطة قرار #1): `useSearchParams` لقراءة `?tab=reviews` كقيمة ابتدائية لـ `detailTab` (سطر 79). صفر تغيير على منطق التبويبات أو الـ ReviewsPanel.

## الحدود (خارج نطاق هذا الـ session)
- **badge عدد الـ PENDING لكل مشروع في المنتقي** — يتطلب N×M calls (`listPhaseUpdates` لكل phase لكل مشروع) = بالظبط الـ over-fetch اللي S4 تجنّبه. مؤجّل (يحتاج endpoint عدّاد خلفي).
- **bidirectional URL↔tab sync** (الكتابة على الـ URL عند تبديل التبويب) — السطح الأكبر المؤجّل من S4. نقرأ الـ param مرة واحدة فقط.
- **search/filter wiring** على المنتقي — نفس حالة `projects/page.tsx` (UI-only، WEB-S3-004). لو أضفت search box، UI-only بـ TODO.
- **تعديل `ReviewsPanel` / الـ updates hooks / client.ts** — صفر لمس (الطبقة دي مقفولة ومُختبَرة في S4).

## تعريف النجاح
- [ ] `reviews/page.tsx` يعرض مشاريع حقيقية من `useProjects()` مع loading/empty/error states.
- [ ] كل مشروع يـ link لـ `dashboard/projects/[id]?tab=reviews` (أو `/projects/[id]` لو نقطة القرار #1 اترفضت).
- [ ] project detail يفتح على تبويب المراجعات لمّا `?tab=reviews` موجود؛ يفتح على المراحل افتراضياً بدونه (صفر regression على المسار العادي).
- [ ] صفر `ReviewItem` mock متبقّي؛ صفر خطأ tsc جديد فوق الـ 5 baseline (WEB-TSC-001 ×2، WEB-TSC-002 ×2، WEB-STORE-001).
- [ ] المبرمج قرأ `node_modules/next/dist/docs/` الخاص بـ `useSearchParams`/client components قبل الكود (توجيه `apps/web/AGENTS.md`).

---
⏸️ AWAITING APPROVAL — رد بـ "approve" للبداية (المبرمج → تنفيذ + `02-coder-report.md`).
نقطة القرار #1 (`?tab=reviews` deep-link vs link بسيط للـ detail) محتاجة إقرارك.

✋ تم Scope — للدور التالي (💻 المبرمج)؟
