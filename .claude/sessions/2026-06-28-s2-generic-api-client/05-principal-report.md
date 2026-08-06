# تقرير المراجع الأعلى — Session S2

> 👁️ المراجع الأعلى — لا يثق في حد، حتى نفسه.
>
> **ملاحظة على الـ mode:** الـ session اتنفّذ **Standard mode** (🧠 المخطط → 💻 المبرمج → 🧪 المختبر؛ 4 ملفات). الـ 05 ده **إضافة صريحة فوق Standard** بطلب المستخدم — يعني **مفيش دور 🔴 هاكر مستقل** اشتغل، ومفيش 01-architect post-exec. المراجعة الأمنية أدناه مبنية على: (أ) الـ threat-modeling الـ inline في الـ plan/coder (DP1، refresh-loop/stampede)، (ب) الـ 3 security assertions في تقرير المختبر. **غياب الـ red-team pass المستقل مسجّل كـ residual risk صراحةً (R-2).** مش بعتبره تخطّي دور صامت.

---

## ملخص المهمة

الـ session نزّل أول طبقة data-access حقيقية للـ frontend: generic axios `client` بـ Bearer-attach + refresh-on-401 (single retry، shared in-flight، no-loop)، `useMe()` كأول React Query consumer، و`RouteGuard` يتحقق من جلسة حقيقية عبر `/users/me` قبل عرض الـ dashboard. النتيجة: **CVE-S1-002 / WEB-S1-001 (الـ S2-blocker) مقفول ومُختبَر end-to-end.**

---

## مراجعة شاملة

| المحور | التقييم | ملاحظات |
|--------|---------|---------|
| جودة المعمارية | **9/10** | فصل مسؤوليات نظيف (DP1: interceptor يملك الـ teardown، guard يملك الـ redirect)؛ `http-shared` يقفل روح WEB-S1-003 من غير refresh-loop؛ منع stampede/loop مُصمَّم صراحةً. خصم بسيط: الـ hydration بـ `setSession` primitive أثقل من اللازم (side-effect: يمسح `pendingRegistration`) — مقبول على الـ dashboard لكنه رائحة (R-4). |
| جودة الأمان | **7/10** | البوابة الحقيقية = الـ backend JWT guard، والـ client الآن يفرض تحقّق فعلي (مش `auth_hint` المزوّرة). لكن: **مفيش red-team مستقل** (R-2)؛ CSP لسه مفتوح (WEB-S1-002) → XSS نشط يقرأ الـ in-memory token؛ فرع نجاح الـ refresh مش مُختبَر (R-1). |
| جودة الـ Tests | **8/10** | MVT 3/3، والـ paired assertion (MVT #3) على **أعمق طبقة فعلية** (interceptor + store حقيقيين) — دي أفضل نقطة في الـ session وتسوية DP4↔rule#4 كانت صح. خصم: **معيار نجاح #3 في الـ plan (hard reload ⇒ refresh صامت ⇒ dashboard يتحمّل) غير مُختبَر إطلاقاً** (R-1) — الـ MVT غطّى الـ terminal branch بس. |
| جاهزية للـ Production | **7/10** | كود الـ session نفسه جاهز (0 أخطاء جديدة). لكن **`next build` لسه محجوب بـ WEB-TSC-001** (build-blocker pre-existing) → التطبيق ككل مش قابل للـ build للـ production لحد ما يتصلح، خارج نطاق هذا الـ session. |

---

## نقاط القوة

- **الـ paired assertion الأعمق (MVT #3):** المختبر رفض shallow-mock لـ `useMe` وشغّل السلسلة الحقيقية عشان يثبت إن `store.clear()` حصل فعلاً — ده بالظبط الدرس اللي rule #4 اتكتب عشانه (CVE-TEST-011). أفضل قرار في الـ session.
- **منع الـ loop/stampede بالتصميم مش بالصدفة:** `isRefreshCall` guard + bare instance للـ refresh + shared in-flight promise. والـ pure `refresh-policy` طبقة معزولة اتغطّت بـ unit tests نظيفة.
- **الالتزام بـ DP1** أبقى الـ teardown عند أعمق حدث (فشل الـ refresh) وفصل الـ redirect (UI concern) — تصميم صح.
- **الشفافية في الانحرافات:** المبرمج والمختبر وثّقوا انحرافاتهم (setSession بدل setUser، DP4↔rule#4) بدل إخفائها.
- **اكتشاف WEB-STORE-001** أثناء العمل + إثباته pre-existing بطريقة منهجية (إزالة ملفات المرحلة + إعادة tsc).

## نقاط الضعف

1. **معيار نجاح غير مُختبَر (R-1):** الـ plan (line 104) نصّ «hard reload بجلسة صالحة ⇒ refresh صامت ⇒ dashboard يتحمّل» كمعيار نجاح — ده **مفيش spec له**. الـ MVT غطّى الـ terminal-401 بس، مش فرع 401→refresh-ينجح→retry-ينجح. ده أهم مسار UX في الـ feature ولسه unverified.
2. **مفيش red-team مستقل (R-2):** Standard mode. الـ interceptor فيه سطح هجوم حقيقي (retry recursion، header injection عبر config، behaviour لما `error.config` = undefined) ما اتفحصش بشكل خصامي.
3. **RouteGuard يطرد على أي `isError` مش بس terminal-auth (R-3):** مع `retry:false`، أي 500/network-blip على `/users/me` ⇒ `isError` ⇒ redirect لـ `/login` رغم إن الجلسة ممكن تكون صالحة. طرد خاطئ محتمل على شبكة متقطعة.
4. **`setUser` phantom + hydration بـ setSession (R-4):** WEB-STORE-001 trap قائم؛ والـ workaround (setSession) بيمسح `pendingRegistration` كـ side-effect غير مقصود على مسار `/users/me`.

---

## مخاطر متبقية

| # | الخطر | المستوى | التوصية |
|---|-------|---------|---------|
| R-1 | فرع الـ refresh-success + الـ silent-recovery (معيار نجاح #3) غير مُختبَر | 🟡 MEDIUM | **قبل ربط أي data ثقيلة:** spec يرجّع 401 ثم 200 من الـ transport ويؤكّد الـ dashboard اتحمّل + الـ token اتجدّد. مرشّح WEB-S1-004. |
| R-2 | مفيش red-team pass مستقل على `client.ts` | 🟡 MEDIUM | Deep-mode session قصيرة (🔴 هاكر) على الـ interceptor فقط، أو قبول واعٍ إن الـ backend JWT guard هو البوابة. |
| R-3 | طرد خاطئ على transient error (`isError` عام) | 🟢 LOW-MEDIUM | فرّق بين terminal-auth (401 بعد استهلاك refresh) و transient (5xx/network) داخل الـ guard؛ الأخير يعرض retry مش redirect. |
| R-4 | WEB-STORE-001 phantom `setUser` + setSession side-effect | 🟡 MEDIUM | نفّذ `setUser` في الـ store وبدّل الـ hydration ليه (يقفل الـ trap + يشيل مسح pendingRegistration غير المقصود). في BACKLOG. |
| R-5 | CSP مفتوح (WEB-S1-002) | 🟡 MEDIUM | قائم من S1؛ يزيد إلحاحاً كل ما زادت الـ data الحقيقية في الـ client. |
| R-6 | `next build` محجوب بـ WEB-TSC-001 | 🟡 MEDIUM | pre-existing build-blocker، خارج النطاق — لكن لازم يتقفل قبل أي deploy. |

---

## القرار النهائي

⚠️ **APPROVED WITH NOTES** — الـ session حقّق هدفه الأساسي بجودة عالية: **WEB-S1-001 (الـ S2-blocker) مقفول ومُختبَر end-to-end**، الـ MVT 3/3 على أعمق طبقة، صفر أخطاء جديدة. لكن الموافقة مشروطة بالتالي قبل ربط data حقيقية ثقيلة:

1. **(R-1، إلزامي قبل data ثقيلة)** spec لفرع الـ refresh-success + silent-recovery — ده معيار نجاح مُعلَن في الـ plan ولسه unverified.
2. **(R-4)** إصلاح WEB-STORE-001 (تنفيذ `setUser`) وتحويل الـ hydration ليه.
3. **(R-2 / R-3)** توصية (مش إلزامي هذا الـ session): red-team pass قصير على `client.ts` + التفرقة بين transient/terminal error في الـ guard.

**التحقق من قاعدة الـ auto-reject:** MVT في تقرير المختبر = 3 (> 0) → لا auto-reject. ✅

**ملاحظة إجرائية للتسجيل:** لأن الـ session اتقفل كـ Standard + principal (من غير 🔴 هاكر مستقل)، الـ residuals R-1/R-2/R-3 لازم يتحطّوا في الـ BACKLOG كـ شروط لـ S3، مش يتنسوا.

---

✋ تم المراجع الأعلى (تقرير المهمة) — للدور التالي؟
