# تقرير المختبر — S4: Updates Workflow + Review Inbox + Phases

> **MVT فعلي — كود مكتوب، مش checklist** (rule #2). الـ 5 MVT المُقرّة من المخطط Stage 2 (تكملة) كلها **node-env** مكتوبة وpassing. الـ holder-ownership = checklist موثّق (infra-blocked WEB-S1-004)، مش محتسب — بالضبط كما أقرّ المخطط.

## إحصائيات
- **MVT المطلوب: 5 / المكتوب: 5** ✅ (متطابقان)
- Tests written: **16** (5 MVT مجمّعة عبر 3 ملفات spec)
- Tests passing: **16**
- Tests failing: **0**
- ملفات الـ spec: `updates-client.spec.ts` (جديد)، `phases-client.spec.ts` (جديد)، `idempotency-key.spec.ts` (جديد)
- Coverage: طبقات client + holder (الطبقات pure/node-testable) مغطّاة؛ طبقة render (hooks/components) infra-blocked → checklist.
- tsc: ثابت على الـ 5 baseline (WEB-TSC-001 ×2، WEB-TSC-002 ×2، WEB-STORE-001) — **صفر خطأ جديد** من ملفات الـ spec.

## خريطة MVT → spec (تتبّع الإلزام)

| MVT | الملف / describe | ماذا يثبت | عدد الـ it | النتيجة |
|---|---|---|---|---|
| **MVT-1** | `updates-client.spec.ts` › `updates-client` | method/URL/params/body لكل فعل + **paired (rule #4):** المفتاح الممرَّر === `Idempotency-Key` header على approve & force-cancel (byte-for-byte) | 5 | ✅ |
| **MVT-2** | `phases-client.spec.ts` › `phases-client` | progress + reorder: PATCH + URL + body (عقد المرحلة 8 على مستوى transport) | 2 | ✅ |
| **MVT-3** | `idempotency-key.spec.ts` › `MVT-3 (test أ)` | `generateIdempotencyKey` يطابق `^[A-Za-z0-9_-]{16,64}$` + تمايز 300 قيمة + fallback getRandomValues + **throw** عند غياب Web Crypto | 4 | ✅ |
| **MVT-4** | `idempotency-key.spec.ts` › `MVT-4 (test ب, rule #4)` | الأعمق — `current()` × N بلا reset = **نفس** المفتاح + holders مستقلة | 2 | ✅ |
| **MVT-5** | `idempotency-key.spec.ts` › `MVT-5 (test ج, CVE-S4-001, rule #5)` | النضارة على النية الجديدة — `reset()` = مفتاح جديد متمايز؛ **paired** بدون reset = نفس المفتاح؛ **re-attack (rule #5):** المفتاح **ليس** دائم النضارة (فقط reset يُدوّر) | 3 | ✅ |

## Unit Tests (تفصيل)

| الـ Test | إيه اللي بيختبره | النتيجة |
|---|---|---|
| listPhaseUpdates unwraps + forwards query | envelope unwrap + `params={status,page,limit}` + GET `/phases/ph1/updates` | ✅ |
| getUpdate id-in-URL + unwrap | GET `/updates/u9` | ✅ |
| approveUpdate no-body + **paired key** | POST `/updates/u1/approve`، `body=null`، `header===key` | ✅ |
| rejectUpdate body + no key | POST `/reject`، `{reason}`، header غائب | ✅ |
| forceCancelUpdate body + **paired key** | POST `/force-cancel`، `{reason}` + `header===key` | ✅ |
| overridePhaseProgress PATCH body | PATCH `/phases/ph1/progress`، `{progress:60,reason}` | ✅ |
| reorderPhase PATCH body | PATCH `/phases/ph2/reorder`، `{order:3}` | ✅ |
| generate matches SAFE_KEY ×50 + validator agrees | format + `isValidIdempotencyKey` single-source | ✅ |
| generate distinct ×300 | صفر إعادة استخدام | ✅ |
| generate getRandomValues fallback | 48 hex، SAFE عند غياب randomUUID | ✅ |
| generate THROWS بلا Web Crypto | رفض degrade صامت على فعل مالي | ✅ |
| holder same key ×10 بلا reset | ضمان double-click/retry (rule #4) | ✅ |
| holders مستقلة (lazy) | كل holder مفتاحه | ✅ |
| reset() = مفتاح جديد متمايز | reason-edit = نية جديدة (CVE-S4-001) | ✅ |
| paired — بلا reset نفس المفتاح | idempotent replay محفوظ | ✅ |
| re-attack — ليس دائم النضارة | 25 retry = نفس المفتاح، reset فقط يُدوّر (rule #5) | ✅ |

## Security Tests (ضمن الـ MVT أعلاه)

| الهجوم | كيف يُغطّى | النتيجة |
|---|---|---|
| Idempotency key reuse على render/retry | MVT-4 (استقرار) + MVT-5 re-attack (ليس دائم النضارة) | ✅ محمي |
| Key بشكل ضعيف/collision على فعل مالي | MVT-3 (throw بدل degrade + تمايز 300) | ✅ |
| المفتاح لا يوصل الـ header (double-apply) | MVT-1 paired (`header===key` byte-for-byte) على approve+force-cancel | ✅ |
| reason-change 422-loop (CVE-S4-001) | MVT-5: reset يُدوّر عند نية جديدة، بلا كسر الـ replay | ✅ |

## holder ownership — **checklist (infra-blocked، مش spec)**

المخطط Stage 2 (تكملة) أقرّ صراحةً: "الـ holder مملوك للـ page ويبقى عبر unmount/remount للـ dialog/panel" سلوك **mount/render** محجوب بـ **WEB-S1-004** → **لا spec node-env** (ولا بديل عن MVT-5). التحقّق عبر code-review + tsc:

- [x] الـ holders مُنشأة في الـ **page** بـ `useState(() => createIdempotencyKeyHolder())` (`page.tsx:88-89`) — عمر = عمر الـ route، lazy init.
- [x] تُمرَّر props: page → `ReviewsPanel` (`page.tsx:410-411`) → `UpdateDetailDialog` (`reviews-panel.tsx:184-185`) — **props threading كامل، tsc نظيف**.
- [x] الـ dialog **حذف** `useRef(createIdempotencyKeyHolder())` واستقبلها prop (`update-detail-dialog.tsx:84-85`، `import type`).
- [x] اكتشاف `keepMounted=false` على `Tabs.Panel` (`tabs.tsx:72` + base-ui default) يؤكّد أن الـ holder المملوك للـ dialog/panel **كان سيُدمَّر** على تبديل التبويب — علّة نقل الملكية للـ page.
- [x] فصل reset: `openUpdate` (فتح) → panel؛ `onSuccess` (نجاح) → dialog؛ `onForceCancelReasonChange` (تعديل reason) → dialog (م.7).

**السبب في عدم احتسابه spec:** أي محاولة لاختباره تتطلب mount/unmount فعلي للشجرة React (Tabs → Panel → Dialog) = render env محجوب بـ WEB-S1-004. المنطق النقي وراءه (استقرار + نضارة المفتاح) **مُختبَر بالكامل algorithmically** في MVT-4/5 على الـ holder مباشرةً.

## reorder swap (المرحلة 8) — تغطية

- **العقد المفرد** (PATCH `/phases/:id/reorder` + `{order}`) مغطّى بـ **MVT-2**.
- **سلوك الـ swap بكتابتين** (`mutate → onSuccess → mutate`) = سلوك مكوّن (render-bound) → checklist code-review، لا spec (مطابق لإقرار المخطط).
- **non-atomic tie risk** موثّق كـ residual → BACKLOG (قرار المخطط Stage 2 تكملة، بند 3). **ليس ضمن نطاق MVT هذه الجلسة** — يُغطّى بـ spec عند تنفيذ الـ endpoint الذري الخلفي.

## Verification (literal — rule #8)

`NO_COLOR=1 npx vitest run src/lib/api/updates-client.spec.ts src/lib/api/phases-client.spec.ts src/lib/api/idempotency-key.spec.ts`:
```
 RUN  v3.2.6 D:/tampalets/saas-one/apps/web

 ✓ src/lib/api/idempotency-key.spec.ts (9 tests) 10ms
 ✓ src/lib/api/phases-client.spec.ts (2 tests) 7ms
 ✓ src/lib/api/updates-client.spec.ts (5 tests) 10ms

 Test Files  3 passed (3)
      Tests  16 passed (16)
   Start at  14:44:06
   Duration  1.31s (transform 181ms, setup 868ms, collect 674ms, tests 27ms, environment 1ms, prepare 538ms)

---EXIT:0---
```

`npx tsc --noEmit` (ملفات الـ spec مشمولة):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ ... }' but required in type 'AuthState'.
---EXIT:2---
```
نفس الـ 5 baseline (WEB-TSC-001 ×2، WEB-TSC-002 ×2، WEB-STORE-001). **صفر خطأ جديد** من الـ 3 ملفات spec.

## Bugs اتكشفت أثناء الـ Testing
- لا يوجد. الطبقات المُختبَرة (client + holder) سلوكها مطابق للعقد المُصمَّم؛ الـ paired assertion (المفتاح byte-for-byte على الـ header) مرّت من أول run.

## مناطق لسه محتاجة coverage (→ للمراجع / BACKLOG)
- **hook-level render tests** لدورة حياة الـ holder داخل شجرة Tabs→Panel→Dialog — محجوبة WEB-S1-004؛ حالياً checklist + code-review.
- **override validation UI** (`progressValid`/`reasonValid` inline في `phase-admin-controls.tsx`) — render-bound؛ المنطق بسيط ومغطّى بصرياً، spec يستحق الاستخراج مستقبلاً.
- **reorder atomic swap** — spec يُكتب عند تنفيذ الـ endpoint الذري الخلفي (BACKLOG، قرار المخطط).
- **HTTP integration (supertest)** — قائم في BACKLOG منذ Session 1.6؛ خارج نطاق S4.

## الحكم

✅ **READY** — الـ 5 MVT مكتوبة وpassing (16/16 tests)، coverage كافٍ للطبقات pure/node-testable، MVT budget = 5/5 مطابق لإقرار المخطط، صفر خطأ tsc جديد.
- holder-ownership موثّق كـ checklist (infra-blocked)، مش spec — بالضبط كما أقرّ المخطط Stage 2 (تكملة).
- الـ paired assertion (rule #4) على أعمق مستوى: المفتاح byte-for-byte على الـ transport header، مش مجرد "صالح الشكل".
- re-attack (rule #5) مُطبَّق: الـ spec الجديد (MVT-5) هوجم ضد نمط "مفتاح ثابت + بيانات متغيّرة" — أُثبت أنه لا يجعل المفتاح دائم النضارة.

✋ تم المختبر — للمراجع؟
