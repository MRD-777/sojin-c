# تقرير المراجع الأعلى — Session S1

> 👁️ Principal / Engineering Director — مراجعة شاملة مستقلة. لا أثق في حد، حتى الأدوار السابقة.

---

## ملخص المهمة
توحيد طبقة الـ auth في الـ frontend عبر الـ backend بدل Supabase-direct: إنشاء بنية جلسة (zustand non-persist + auth-client + auth_hint)، حذف `actions.ts` بالكامل، إعادة ربط صفحات login/register/setup بـ client hooks، وإصلاح الـ middleware ليعتمد `auth_hint` بدون فرع NODE_ENV. النتيجة: مصدر حقيقة واحد (backend) للـ auth/RBAC/validation، وإغلاق الـ dev-bypass الخطير.

---

## مراجعة شاملة
| المحور | التقييم | ملاحظات |
|--------|---------|---------|
| جودة المعمارية | **9/10** | فصل pure/I-O نموذجي مكّن MVT بدون mocks؛ نموذج جلسة ثلاثي صحيح (token ذاكرة / refresh httpOnly / hint غير حسّاس). خصم نقطة: `auth-client` instance منفصل سيحتاج توحيد في S2 (drift risk). |
| جودة الأمان | **8/10** | الـ root cause (طبقتا جلسة) اتقفل؛ CVE-S1-001 اتصلح عند أعمق نقطة. خصم نقطتين: CVE-S1-002 (auth_hint) + CVE-S1-003 (لا CSP) مفتوحتان (مبرّرتان لـ S1 لكن blockers لـ S2). |
| جودة الـ Tests | **8/10** | 11/11 passing، MVT 5/5، paired assertions حقيقية على الـ 3 الأمنية. خصم نقطتين: صفر coverage للصفحات/hooks/HTTP layer (مؤجّل لـ jsdom/MSW في S2 — مقبول لكنه فجوة). |
| جاهزية للـ Production | **6/10** | كود S1 سليم، لكن: (أ) `next build` محجوب بـ WEB-TSC-001 (pre-existing)؛ (ب) CVE-S1-002 لازم client guard قبل أي data حقيقية. **ليس deployable لوحده** — جزء من مسار S1→S2. |

---

## نقاط القوة
- **إغلاق الـ root cause فعلياً:** مفيش `supabase.auth`/`supabase.from` في طبقة الـ auth (grep نظيف، متحقَّق 3 مرات) — مش مجرّد wrapper فوق المشكلة.
- **rule #4 مطبّق بعمق حقيقي:** إصلاح CVE-S1-001 ربط مسح الـ secret بـ `setSession` (أعمق primary action) بدل سطر منفصل قابل للنسيان — والـ spec يثبتها بـ precondition + side-effect assertion. ده بالظبط النمط اللي rule #4 اتكتبت عشانه.
- **إزالة dev-bypass:** أخطر سطر في الـ codebase القديم (`NODE_ENV !== 'development'` يسمح dashboard بدون auth) اختفى، والـ spec يثبت غيابه عبر 3 بيئات.
- **انضباط الـ scope:** انحراف واحد فقط (`RegisterOutcome`) وهو تنفيذ أدق لقرار P2 موجود — صفر scope creep عبر 5 مراحل.
- **صدق الـ verification:** literal outputs (vitest + tsc + build) منسوخة كما هي، والأخطاء الـ pre-existing مفصولة بوضوح ومسجّلة في BACKLOG.

## نقاط الضعف
- **CVE-S1-002 (auth_hint):** البوابة الوحيدة للـ dashboard cookie قابلة للتزوير. مقبول **فقط** لأن الـ dashboard mock حالياً (متحقَّق: صفر data fetch). لحظة نزول data حقيقية بدون client guard = HIGH.
- **CVE-S1-003 (لا CSP):** token في الذاكرة يقلّل سرقة persistence-based لكن XSS نشط ما زال يقدر يقرأه؛ غياب CSP يكبّر سطح الحقن.
- **فجوة coverage الصفحات:** منطق التوجيه داخل الصفحات (`router.push("/dashboard")`، branch على `RegisterOutcome`, guard الـ pending) غير مغطّى بـ tests — يعتمد على مراجعة بشرية فقط.
- **build محجوب:** `next build` ما يكملش بسبب WEB-TSC-001 (خارج S1 لكنه يمنع CI الأخضر).

## مخاطر متبقية
| الخطر | المستوى |
|-------|---------|
| CVE-S1-002 يتحوّل HIGH عند نزول data حقيقية في dashboard (S2) | HIGH (S2) / LOW (S1) |
| CVE-S1-003 لا CSP — defense-in-depth ضد XSS→token | MEDIUM |
| `auth-client` drift عن الـ generic client القادم (S2) | MEDIUM |
| رسائل الـ backend عربية فقط في locale=en | LOW |
| WEB-TSC-001 يمنع `next build` الأخضر | MEDIUM (CI) |
| صفر coverage لمنطق الصفحات/hooks | MEDIUM |

---

## القرار النهائي
⚠️ **APPROVED WITH NOTES** — كود S1 متوافق مع الـ plan، الـ MVT 5/5 أخضر (مش auto-reject)، الأمان معالَج عند أعمق نقطة لما كان ممكن. جاهز للانتقال لـ S2، **لكن** بالشروط دي قبل أي production deploy:

1. **S2-blocker:** إضافة client route-guard للـ dashboard (`/users/me` on mount) قبل ربط أي data حقيقية — يقفل CVE-S1-002.
2. **hardening:** CSP report-only ثم enforce (CVE-S1-003).
3. **CI:** إصلاح WEB-TSC-001 عشان `next build` يعدّي.
4. **S2 test-infra:** jsdom + RTL + MSW لتغطية الصفحات والـ hooks والـ HTTP layer.
5. **S2:** توحيد `auth-client` مع الـ generic client + refresh-on-401 interceptor + i18n لرسائل الـ backend.

🔴 فحص الـ auto-reject: MVT في تقرير المختبر = 5 (> 0) → **لا auto-reject**. القرار يقف عند APPROVED WITH NOTES.

البنود 1-5 تتسجّل في BACKLOG ضمن residuals الـ S1 (بجانب WEB-CLEANUP-001 و WEB-TSC-001 المسجّلين).

✋ تم المراجع (تقرير المهمة) — للدور التالي (meta-review)؟
