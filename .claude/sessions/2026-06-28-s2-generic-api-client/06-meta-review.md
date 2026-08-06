# مراجعة الأدوار (Meta Review) — Session S2

> 👁️ المراجع الأعلى — المراجعة الثانية (تقييم الأدوار نفسها، مش المهمة).
>
> **سياق الـ mode:** الـ session اتنفّذ **Standard (3 أدوار: 🧠 المخطط → 💻 المبرمج → 🧪 المختبر)** + دور 👁️ المراجع مضاف صراحةً بطلب المستخدم. **مفيش 🔴 هاكر مستقل** و**مفيش 01-architect post-exec**. عشان كده قسم الهاكر أدناه **n/a (لم يُشغَّل)** — مش تقييم صفر، ده غياب بنيوي مقصود في الـ mode، ومسجّل كـ residual (R-2) في تقرير المراجع. تقييم المخطط أدناه مبني على `00-plan.md` (pre-exec) بس، لأن مفيش post-exec report يتقيّم.

---

## 🧠 المخطط

| المعيار | التقييم |
|---------|---------|
| الوضوح | 9/10 |
| الاكتمال | 8/10 |
| دقة التفاصيل | 9/10 |
| توقع المخاطر | 7/10 |

- **اللي عمله صح:**
  - الـ 4 decision points (DP1–DP4) اتحسموا صراحةً مع مبرر لكل واحد — خصوصاً DP3 (رفض دمج الـ instances لأنه يرجّع الـ refresh-loop) وDP1 (فصل ملكية الـ teardown عن الـ redirect حسب rule #4). ده تفكير معماري ناضج قبل أي سطر كود.
  - توقّع الـ refresh stampede والـ refresh loop **قبل** التنفيذ وحطّ لكل واحد حل مسمّى (shared in-flight promise + `isRefreshCall` guard).
  - الـ MVT budget (3 specs) اتربط بأرقام سطور محددة وربط MVT #3 بـ rule #4 (deepest paired assertion) صراحةً — ده اللي وجّه المختبر للقرار الصح.
- **اللي قصّر فيه:**
  - **توتر داخلي بين DP4 و MVT #3** (shallow mock vs deepest assertion) — المختبر هو اللي اضطر يحلّه في الـ runtime. المخطط كان لازم يشوف التعارض ده وقت التخطيط ويحسمه لصالح rule #4 من البداية.
  - **كتب معيار نجاح #3 (hard-reload ⇒ silent refresh) من غير ما يخصّص له MVT** — سطّره كـ نجاح مطلوب (line 104) لكن ميزانية الـ 3 specs غطّت الـ terminal branch بس. النتيجة = R-1 (أهم مسار UX ساب من غير تغطية). فجوة تخطيط مباشرة.
  - **`setUser` phantom** كان مذكور في قائمة helpers الـ plan بشكل يوحي إنه متاح — المبرمج اكتشف إنه غير مُنفَّذ. المخطط ما تحقّقش من الـ store interface قبل ما يبني عليه.
- توقّع المخاطر: قوي على الـ transport-layer (loop/stampede)، ضعيف على الـ UX-layer (R-1 silent recovery، R-3 transient-error redirect لا واحد منهم اتوقّع).
- نسبة الأخطاء: ~15% (فجوتان تخطيطيتان أنتجتا R-1 وجزء من R-4).
- التقييم: 👍 **جيد**

## 💻 المبرمج

| المعيار | التقييم |
|---------|---------|
| الالتزام بالـ Plan | 9/10 |
| جودة الكتابة | 9/10 |
| معالجة الـ Edge Cases | 8/10 |
| الالتزام بالـ Skills | 9/10 |

- **اللي عمله صح:**
  - نفّذ DP3 عبر `http-shared.ts` (استخراج helper مشترك) بدل نسخ الكود — ده «توحيد» حقيقي مش «تكرار»، ووثّقه كانحراف مبرَّر مع ربطه بنصّ الـ plan.
  - **اكتشف WEB-STORE-001 (`setUser` phantom) وأثبته pre-existing منهجياً** (إزالة ملفات المرحلة + إعادة tsc) بدل ما يفترض أو يخفي. وبدل ما يلمس ملف خارج نطاق المرحلة، اختار `setSession` (helper مُنفَّذ فعلاً ومذكور في الـ plan) — قرار انضباطي صح.
  - Verification حرفي (rule #8) في المرحلتين، مع تحليل صادق لأخطاء الـ tsc: صحّح توقّع الـ plan (2 pre-existing) للواقع (5) وسمّى كل واحد.
- **اللي قصّر فيه:**
  - **الـ Stage 1 report عدّ 4 أخطاء tsc، والفعلي 5** — خطأ `setUser` (TS2741) فاته في المرحلة 1 واتلقط في المرحلة 2. عدّ ناقص، حتى لو كلها pre-existing.
  - الـ `setSession` workaround (وإن كان مبرَّراً داخل النطاق) أدخل side-effect صامت: مسح `pendingRegistration` على مسار `/users/me` — المبرمج ما علّقش على الـ side-effect ده وقت ما اختاره (المراجع هو اللي رفعه كـ R-4).
- Bugs اتعملت: **0** جديدة. (كل أخطاء الـ tsc pre-existing، مُثبَت.)
- نسبة الأخطاء: ~8% (عدّ tsc ناقص + side-effect غير مُعلَّق).
- التقييم: ✅ **ممتاز**

## 🔴 الهاكر

**n/a — لم يُشغَّل (Standard mode).**

- مفيش دور هاكر مستقل في الـ session ده بحكم الـ mode. مايتقيّمش بصفر ولا بأي درجة — الغياب **بنيوي ومقصود**.
- **لكنه مش بلا تكلفة:** المراجع سجّله صراحةً كـ R-2 (سطح هجوم `client.ts` غير مفحوص خصامياً: retry recursion، header injection عبر config، سلوك لما `error.config === undefined`). التهديد-موديلينج الـ inline في الـ plan غطّى loop/stampede بس — مش بديل عن red-team pass.
- **درس إجرائي:** أي session بتقفل CVE (زي CVE-S1-002 هنا) وبتضيف interceptor جديد يتعامل مع الـ auth، **يفضّل ترفع لـ Deep** عشان الـ 🔴 هاكر يفحص السطح الجديد — مش تكتفي بـ Standard + principal. (توصية للـ scoring، مش لوم على تنفيذ الـ session ده اللي اتفق على الـ mode صراحةً.)

## 🧪 المختبر

| المعيار | التقييم |
|---------|---------|
| شمولية التغطية | 7/10 |
| جودة الـ Assertions | 10/10 |
| اكتشاف الـ Bugs | 8/10 |
| معالجة الـ Edge Cases | 8/10 |

- **اللي عمله صح:**
  - **أفضل قرار في الـ session كله:** رفض shallow-mock لـ `useMe` في MVT #3، وشغّل السلسلة الحقيقية (transport → interceptor حقيقي → refresh فشل → `terminateSession()` فعلي → store حقيقي) عشان يثبت إن `accessToken` اتصفّى من `'tok'` → `null` **فعلاً**، مش إنه كان null أصلاً. ده بالظبط الدرس اللي rule #4 اتكتب عشانه (CVE-TEST-011 في Session 1.6). حسم توتر DP4↔rule#4 لصالح القاعدة الأقوى ووثّقه.
  - MVT 3/3 مطابق للـ budget، بلا padding. الـ pure `refresh-policy` اتغطّى بوضوح (fresh / isRefreshCall / alreadyRetried / boundary).
  - **صادق في قسم «مناطق لسه محتاجة coverage»** — عدّ الفروع المؤجّلة صراحةً (refresh-success retry، stampede، hydration success، loading/success states) بدل ما يدّعي تغطية كاملة.
- **اللي قصّر فيه:**
  - **الفجوة الكبرى: فرع 401→refresh-ينجح→retry-ينجح غير مُختبَر** = R-1. المختبر عدّه في «مؤجّل» (صادق)، لكنه **معيار نجاح مُعلَن في الـ plan (line 104)** مش مجرد nice-to-have — كان يستاهل flag أقوى («معيار نجاح غير مستوفى» مش «coverage مؤجّل»). المراجع هو اللي رفع مستواه.
  - **ما رفعش R-3** (الـ guard يطرد على أي `isError` مش بس terminal-auth) — دي حالة كان ممكن spec سالب يكشفها (500 على `/users/me` ⇒ redirect خاطئ). فاتت على المختبر تماماً، المراجع لقاها.
- Scenarios فاتته: R-1 (silent recovery) + R-3 (transient-error redirect).
- نسبة الأخطاء: ~12% (assertions مثالية، لكن شمولية السيناريوهات السالبة ناقصة).
- التقييم: 👍 **جيد** (جودة assertions ممتازة ترفعه، شمولية التغطية تخصم منه).

---

## ملخص عام

- **أفضل دور: 🧪 المختبر** — السبب: تسوية DP4↔rule#4 كانت أعلى قرار جودة في الـ session. أثبت الـ teardown على أعمق طبقة فعلية بدل false-confidence، وهو بالظبط الـ pattern اللي الـ CLAUDE.md بُني لمنعه. جودة الـ assertion غطّت على نقص الشمولية.
- **أضعف دور: 🧠 المخطط** — السبب: فجوتان تخطيطيتان (معيار نجاح #3 من غير MVT = R-1، والتوتر DP4↔MVT#3 اللي المختبر اضطر يحلّه) نبعتا من التخطيط نفسه. مايزال «جيد»، لكنه الأكثر مسؤولية عن أخطر residual.

## دروس للـ Sessions القادمة

- **كل معيار نجاح في الـ plan لازم يقابله MVT صريح، أو يتعلّم «deferred» صراحةً في نفس السطر.** R-1 نتج مباشرةً من معيار نجاح مكتوب من غير ميزانية test — لو الـ MVT budget اشترط «spec لكل معيار نجاح أو deferred مبرَّر»، كان اتلقط في التخطيط.
- **التوتر بين decision points لازم يتحسم في الـ plan، مش في الـ runtime.** DP4 (shallow) عارض MVT #3 (deep). المخطط يفضّل يعمل reconcile للـ DPs ضد الـ hard rules (#4) قبل ما يسلّم.
- **Standard + principal مش بديل عن Deep لما فيه سطح هجوم جديد.** أي interceptor/guard جديد بيمسّ الـ auth = مرشّح لرفع الـ mode لـ Deep عشان الـ 🔴 هاكر، مش الاكتفاء بالـ threat-modeling الـ inline.
- **R-1 و R-3 اكتشافات مهمة (بطلب المستخدم — تسجيل دقيق):**
  - **R-1 (MEDIUM):** فرع الـ refresh-success + silent-recovery (معيار نجاح #3: hard-reload بجلسة صالحة ⇒ refresh صامت ⇒ dashboard يتحمّل) **غير مُختبَر إطلاقاً**. المطلوب: spec يرجّع 401 ثم 200 من الـ transport ويؤكّد (أ) الـ dashboard اتحمّل، (ب) الـ token اتجدّد في الـ store. **شرط إلزامي قبل ربط أي data ثقيلة (S3).** مرشّح WEB-S1-004.
  - **R-3 (LOW-MEDIUM):** `RouteGuard` يطرد على **أي** `isError` (مع `retry:false`)، مش بس terminal-auth. أي 500/network-blip على `/users/me` ⇒ redirect لـ `/login` رغم جلسة صالحة = طرد خاطئ على شبكة متقطعة. المطلوب: تفرقة داخل الـ guard بين terminal-auth (401 بعد استهلاك refresh) و transient (5xx/network) — الأخير يعرض retry مش redirect.
  - **إجراء:** R-1 و R-3 (مع R-2 red-team) لازم يدخلوا `.claude/sessions/BACKLOG.md` كـ **شروط لـ S3** حسب الملاحظة الإجرائية في تقرير المراجع — مش يتنسوا مع إغلاق الـ session.

## تحذيرات للأدوار

- **للمخطط:** لكل معيار نجاح، اكتب MVT مقابل أو علّم deferred في نفس السطر. واعمل reconcile للـ decision points ضد الـ hard rules قبل التسليم — متسبش المختبر يكتشف التعارض.
- **للمبرمج:** عدّ أخطاء الـ tsc كاملةً من أول مرحلة (فاتك `setUser` في Stage 1). ولما تختار workaround له side-effect (setSession يمسح pendingRegistration)، علّق على الـ side-effect صراحةً وقت الاختيار.
- **للهاكر:** الـ session ده ما شغّلكش (Standard). لكن `client.ts` interceptor محتاج pass خصامي في S3: retry recursion، header injection عبر `error.config`، وسلوك `error.config === undefined`.
- **للمختبر:** فرّق بين «coverage مؤجّل» (nice-to-have) و«معيار نجاح غير مستوفى» (blocker محتمل) — R-1 كان التاني واتصنّف كالأول. وفكّر في specs سالبة للـ error-branches (R-3 كان spec 500-على-me هيكشفه).

✋ تم — الـ session مقفولة. الملفات جاهزة للمراجعة: 00-scope · 00-plan · 02-coder · 04-tester · 05-principal · 06-meta-review (Standard + principal؛ مفيش 01/03 بحكم الـ mode).
