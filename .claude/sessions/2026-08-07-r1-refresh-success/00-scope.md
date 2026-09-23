# Scope — R-1: مسار refresh-success غير مُختبَر في `client.ts`

## Mode: Standard
السبب: البند **coverage-first** على كود قائم مستقر (صفر تعديل مخطَّط على `client.ts`)،
لكنه يحتاج plan (اختيار الـ harness + budget) و tester pass مستقل بـ mutation — فـ Quick
ضيّق و Deep زائد.

> ⚠️ **شرط الترقية الصريح (لا صامت):** لو المرحلة 1 (قراءة الكود) أو المختبر أثبتا
> **خرقاً أمنياً حقيقياً** في الـ interceptor (لا مجرد فجوة تغطية) ⇒ **ترقية معلنة لـ Deep**
> (يستدعي 🔴 هاكر pass = بند `R-2` القائم). البند R-2 نفسه **خارج نطاق هذه الـ session**
> ويظل مفتوحاً بعدها.

---

## المهمة

الـ refresh-on-401 interceptor في `apps/web/src/lib/api/client.ts` (Session S2) مُختبَر
حالياً **لفرع الفشل فقط**: `route-guard.spec.tsx` بيدفع 401 على `/users/me` مع
`authClient.refresh` **مرفوض** ⇒ terminal teardown + redirect. فرع **النجاح**
(401 ⇒ refresh ينجح ⇒ retry بالتوكن الجديد ⇒ الـ caller بياخد الـ data) —
**وهو المسار الأغلب عملياً** — **صفر تغطية**.

الـ session تكتب specs للفرع الناجح + حارس الـ single-retry + حارس الـ stampede،
**بدون تعديل سلوكي على `client.ts`** إلا لو ظهر gap حقيقي — وساعتها يُوثَّق ويُرفَع
قبل أي إصلاح (شرط المستخدم صراحةً).

---

## الحالة القائمة — قراءة مباشرة للكود (تمّت قبل كتابة الـ scope)

`client.ts` (117 سطر) — الفروع الأربعة في الـ response interceptor:

| # | الفرع | مغطّى اليوم؟ | بواسطة |
|---|---|:---:|---|
| 1 | 401 ⇒ `shouldRefresh=true` ⇒ refresh **ينجح** ⇒ `client(config)` retry ينجح | ❌ **لا** | — |
| 2 | 401 ⇒ refresh **يفشل** ⇒ `terminateSession()` + reject | ✅ | `route-guard.spec.tsx` (MVT #3، S2) |
| 3 | 401 و `config._retry === true` ⇒ terminal مباشرةً (بلا refresh تانٍ) | ⚠️ **جزئياً** | `refresh-policy.spec.ts` بيغطّي الـ **دالة النقية** فقط — مش وصول الـ flag للـ interceptor |
| 4 | الـ stampede: N طلبات متزامنة تـ 401 ⇒ refresh **واحد** مشترك | ❌ **لا** | — |

**نقطة دقّة مهمة للمخطط:** `refresh-policy.spec.ts` (4 tests) بيختبر `shouldRefresh` كـ
pure function. ده **لا يثبت** إن `config._retry` بيوصلها فعلاً من الـ interceptor —
الحلقة بين `config._retry = true` (سطر 100) و `client(config)` (سطر 102) و
`error.config._retry` في الاستدعاء التالي (سطر 91) **غير مُختبَرة**، وهي تعتمد على
سلوك `mergeConfig` في axios تجاه المفاتيح غير المعروفة. ده بالظبط نمط «القيد موجود
في طبقة، والاختبار على طبقة تانية» — الـ spec لازم يعضّ على **الـ interceptor**
لا على الدالة النقية.

---

## الملفات المتأثرة

| الملف | إيه اللي هيتغير | Coverage budget |
|---|---|---|
| `apps/web/src/lib/api/client.spec.ts` | 🆕 **ملف جديد** — كل الـ MVT | يحدّده الـ plan |
| `apps/web/src/lib/api/client.ts` | **قراءة فقط.** أي تعديل = انحراف يُبلَّغ ويوقف | — |
| `.claude/sessions/2026-08-07-r1-refresh-success/*` | 4 ملفات Standard mode | — |
| `.claude/sessions/BACKLOG.md` | تحديث حالة R-1 عند الإقفال + أي gap جديد | — |

---

## الوحدات المشمولة بالاسم + budget (قاعدة #6)

| الوحدة | الملف | Budget |
|---|---|---|
| `client` — response interceptor، **فرع النجاح** | `lib/api/client.ts:83-116` | **≥1 spec** (إلزامي — جوهر R-1) |
| `client` — حارس الـ single-retry (`_retry`) على مستوى الـ interceptor | `lib/api/client.ts:91,100` | **≥1 spec** (إلزامي) |
| `refreshAccessToken` — singleton الـ in-flight | `lib/api/client.ts:58-74` | **≥1 spec** (إلزامي — concurrency) |
| `client` — request interceptor (حقن الـ Bearer) | `lib/api/client.ts:49-55` | مغطّى **ضمناً** داخل specs الفرع الناجح (تأكيد على الـ header المُرسَل byte-for-byte) — لا spec مستقل |
| `terminateSession` | `lib/api/client.ts:77-80` | **مغطّى سلفاً** — `route-guard.spec.tsx` (S2). لا تكرار |
| `shouldRefresh` | `lib/api/refresh-policy.ts` | **مغطّى سلفاً** — `refresh-policy.spec.ts` (4 tests). لا تكرار |
| `authClient.refresh` (الـ HTTP الفعلي لـ `/auth/refresh`) | `lib/api/auth-client.ts:73` | **deferred** — يُعامَل كـ mock boundary (DP4)، تغطيته بند `WEB-S1-004` |
| `useAuthStore` | `store/use-auth-store.ts` | **deferred** — لا تُختبَر مباشرةً؛ تُستخدَم كـ paired assertion على التوكن الجديد |

---

## تعريف النجاح

- [ ] spec يثبت **الفرع الناجح end-to-end**: 401 ⇒ refresh ⇒ retry ⇒ **الـ caller بياخد الـ data الصح**
- [ ] **Paired assertion على أعمق طبقة (قاعدة #4):** مش بس «الـ promise resolve» —
      لازم يتأكّد إن الطلب المُعاد حمل **التوكن الجديد نفسه** في الـ `Authorization` header
      على مستوى الـ **transport** (adapter config)، وإن الـ store اتحدّث للقيمة الجديدة
- [ ] spec يثبت **retry واحد بالظبط** على مستوى الـ interceptor: 401 ⇒ refresh ينجح ⇒
      الـ retry بيرجع 401 تانٍ ⇒ **مفيش refresh تانٍ** (`refresh` calls === 1) + عدد
      استدعاءات الـ transport محدود (لا infinite loop) + teardown نهائي
- [ ] spec يثبت **مفيش stampede**: N طلبات متزامنة تـ 401 ⇒ `authClient.refresh` **مرة واحدة**
      + الـ N كلهم بياخدوا نتايجهم الصح
- [ ] **MVT: العدد يحدّده الـ plan** (قاعدة #3) — والمختبر يطابقه
- [ ] **Mutation check (قاعدة #5ب/#5b):** كل spec من التلاتة يسقط لما يُعطَّل القيد اللي
      بيحرسه، **وحده** — بلا سقوط جانبي. بلا ده = تغطية غير مُثبَتة
- [ ] `npx tsc --noEmit` بلا أخطاء **جديدة** فوق الـ baseline المعروف (WEB-TSC-001/002 + WEB-STORE-001)
- [ ] الـ suite الكامل passing بلا regression — الـ **literal stdout** منسوخ (قاعدة #8)
- [ ] أي gap حقيقي في `client.ts` → **موثَّق ومرفوع، غير مُصلَّح** في هذه الـ session

---

## الحدود (خارج النطاق صراحةً)

- ❌ **أي تعديل سلوكي على `client.ts`** — الـ session تغطية. أي gap يُرفَع كـ ticket ويقف
- ❌ **R-2** (red-team مستقل على `client.ts`) — يظل مفتوحاً بعد هذه الـ session
- ❌ **R-3** (RouteGuard يطرد على أي `isError`) — بند منفصل
- ❌ **R-4 / WEB-STORE-001** (`setUser` phantom) — بند منفصل
- ❌ **WEB-S1-004** (MSW + RTL infra كامل) — هنا نستخدم **نفس harness الـ adapter-mock**
      القائم في `projects-client.spec.ts` / `route-guard.spec.tsx`، بلا بنية جديدة
- ❌ ربط `payments/summary` أو أي Finance frontend — R-1 حاجب له، وقفله هنا **يرفع الحجب فقط**
- ❌ أي إصلاح لأخطاء الـ tsc الـ baseline القائمة

---

## المخاطر المعروفة قبل البداية

| # | الخطر | التخفيف |
|---|---|---|
| 1 | `refreshInFlight` **module-level global** — بيتسرّب بين الـ tests لو refresh معلّق | كل spec يـ await النتيجة النهائية؛ `afterEach` يرجّع الـ adapter + `restoreAllMocks` |
| 2 | spec «وصفي» يكتفي بـ `resolves` بلا التأكيد على الـ header المُرسَل ⇒ **نفس عيب S7** | معيار النجاح #2 يفرض التأكيد على الوسيطة (transport config) لا على النتيجة |
| 3 | axios `mergeConfig` ممكن **ما يـ propagate-ش** `_retry` (مفتاح غير معروف) ⇒ الـ retry يعيد الـ refresh | ده **بالظبط** اللي spec الـ single-retry موجود يكشفه. لو سقط ⇒ **gap حقيقي** يُرفَع، **لا يُصلَح** |

---

⏸️ AWAITING APPROVAL — رد بـ "approve" للانتقال للمخطط.

✋ تم الـ Scope — للدور التالي (🧠 المخطط)؟
