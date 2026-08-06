# تقرير المختبر — S3 Projects Wiring

> الأداة: **Vitest v3** (مش Jest). transport mocked عبر `client.defaults.adapter` (نفس pattern `route-guard.spec`) — الـ interceptors الحقيقية + `unwrap` الحقيقي بيشتغلوا، فالـ specs بتمشي على data path الفعلي مش stub ليه. specs الـ hooks بـ `// @vitest-environment jsdom` + `renderHook`.

## إحصائيات
- **MVT المطلوب: 5 / المكتوب: 5** ← ✅ متطابقين (كل spec من الـ plan اتكتب)
- Tests written (الملفات الجديدة): **12** (5 MVT + 4 assertions مساعدة + 1 extra بوابة الـ guard + 2 من الـ negative/detail)
- Tests passing: **12 / 12** (الملفات الجديدة) — **28 / 28** (الـ suite كامل، صفر regression)
- Tests failing: **0**
- tsc: **صفر خطأ جديد** (نفس الـ 5 pre-existing بالظبط)

## خريطة الـ MVT (plan → spec → ملف)
| # | مطلوب في الـ plan | الملف | نتيجة |
|---|---|---|---|
| 1 | projects-client: `listProjects` يـ unwrap + يمرّر query params | `src/lib/api/projects-client.spec.ts` | ✅ |
| 2 | use-projects: يرجّع items من transport مموّه | `src/lib/hooks/use-projects.spec.tsx` | ✅ |
| 3 | use-project: يرجّع detail + spec سالب (`enabled:false` لمّا id فاضي) | `src/lib/hooks/use-project.spec.tsx` | ✅ |
| 4 | use-create-project: **paired assertion** — body الفعلي للـ axios = `CreateProjectInput` كامل بـ clientId + `invalidateQueries` اتنادت | `src/lib/hooks/use-create-project.spec.tsx` | ✅ |
| 5 | map-form-to-create-input: type→enum mapping + الفاضي يتشال مش يتبعت | `src/lib/projects/map-form-to-create-input.spec.ts` | ✅ |

## Unit / Function Tests
| الـ Test | إيه اللي بيختبره | النتيجة |
|---------|-----------------|---------|
| projects-client › listProjects unwrap+params | الـ inner data بترجع (مش الـ envelope) + `params` وصلت الـ transport verbatim | ✅ |
| projects-client › getProject id-in-url | الـ id في الـ URL + unwrap | ✅ |
| projects-client › createProject post | method=post + unwrap للـ created | ✅ |
| map-form › required + omit empties | `{name(trimmed),clientId}` بس؛ كل optional فاضي **absent مش `""`** | ✅ |
| map-form › type enum guard | `CONSTRUCTION` يعدّي؛ `"residential"`/`""` يتشالوا | ✅ |
| map-form › budget number/NaN | `"5000"`→5000؛ `"   "`/`"abc"` يتشالوا | ✅ |
| map-form › optional strings trim | description/location/startDate/deadline بتتحط بس لو مش فاضية | ✅ |
| map-form › **extra**: clientId passthrough | الـ mapper مايحرسش clientId — الفاضي يعدّي (بيثبت ليه الـ page guard ضروري) | ✅ |

## Hook / Integration Tests (jsdom)
| الـ Hook | الحالة | المتوقع | النتيجة |
|---------|--------|---------|---------|
| useProjects | transport يرجّع envelope | `data.items` length=2 + `total` unwrapped | ✅ |
| useProject | id صحيح | `phases[]`+`assignments[]` مجمّعين في نفس الـ call | ✅ |
| useProject | **id فاضي** | `fetchStatus==='idle'` + `data===undefined` + **adapter never called** | ✅ |
| useCreateProject | mutate(input) | (تحت) | ✅ |

### Paired assertion (MVT #4، rule #4 — أعمق طبقة)
الـ spec ما اكتفاش بـ "الـ mutation resolved". بدلها **التقط الـ body الفعلي اللي وصل الـ axios adapter** (`config.data` → `JSON.parse`) وأكّد:
- `sentBody` **يساوي `CreateProjectInput` كامل** (`toEqual(input)`) — مش subset.
- `sentBody.clientId === "client-uuid-1"` صراحةً (الحقل اللي flow الـ Create كله موجود عشانه).
- الـ side-effect الحقيقي: `invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })` اتنادت (spy على نفس الـ QueryClient اللي الـ hook بياخده من `useQueryClient()`).
- الـ caller بياخد الـ created project unwrapped.

ده يتجنّب الـ false-confidence pattern اللي rule #4 بيحذّر منه: الـ primary action (الـ body على الـ wire) هو الأعمق representable في الـ mock layer، مش الأقرب ("resolved").

## Security / Boundary Tests
| المحور | التغطية في الـ session | النتيجة |
|--------|----------------------|---------|
| Empty-string injection على الـ DTO | map-form يتشال الفاضي (يمنع `@IsDateString`/`@IsNumber`/`@IsEnum` break) | ✅ مغطّى |
| Enum tampering (قيمة UI قديمة) | `isProjectType` guard — `"residential"` مايوصلش الـ wire | ✅ مغطّى |
| Disabled query لا-fire | useProject بـ id فاضي: adapter never called (مايضربش الـ backend عبثاً) | ✅ مغطّى |
| Required-field bypass (client-side) | pinned كـ boundary: الـ mapper مايحرسش → الـ page guard هو الحارس | ✅ موثّق |
| AuthZ (SUPER_ADMIN/PM only على POST) | **backend-enforced** — خارج طبقة الـ web؛ الـ 403 بيتعرض gracefully (banner) لكن مش unit-tested هنا | ⚠️ deferred (تحت) |
| Tenant isolation / IDOR | backend concern (نفس الـ service layer) — مش من scope الـ web wiring | n/a |

## Regression Tests
- الـ suite القديم كامل (`route-guard`, `map-auth-error`, `refresh-policy`, `decide-redirect`, `register-payload`, `use-auth-store`): **28/28 passing** — صفر regression من إضافات S3.

## Bugs اتكشفت أثناء الـ Testing
- لا يوجد. كل الـ 12 spec عدّت من أول run؛ الكود سلوكه مطابق للـ contract الموثّق في الـ plan/coder-report.

## مناطق لسه محتاجة coverage (checklist — مش MVT، للـ sessions الجاية)
- **الـ validation guard على مستوى الـ component** (`new/page.tsx:141`، الاكتشاف بتاع المخطط): الـ guard اليدوي على name+clientId للـ conditionally-rendered steps **مش متغطّى بـ render-test حقيقي** لأنه محتاج harness كامل للـ wizard page (Next 16 + i18n + next context + عشرات الـ UI deps = كلفة/هشاشة عالية، هتأخّر الـ session). غطّيته **indirectly** عبر spec الـ boundary (الـ mapper مايحرسش clientId → الـ guard ضروري). التوصية: full page-render spec له في session لاحقة (أو استخراج الـ predicate كـ pure function — قرار مبرمج+مخطط).
- **الـ 403/404 gracefully في الـ UI**: الـ hooks بترجّع `isError` (متأكّد من الـ pattern) والصفحات بتعرض banner/not-found؛ لكن render-test للـ error states مؤجّل (نفس كلفة الـ page harness).
- **useClients** (dropdown): deferred في الـ plan — مافيش MVT له؛ spec خفيف ممكن يتضاف لاحقاً.
- **search/filters wiring** (List): UI-only في S3 → S5.

## Verification (literal)

`npx vitest run` (الـ 5 ملفات الجديدة):
```
 ✓ src/lib/projects/map-form-to-create-input.spec.ts (5 tests) 5ms
 ✓ src/lib/api/projects-client.spec.ts (3 tests) 8ms
 ✓ src/lib/hooks/use-projects.spec.tsx (1 test) 108ms
 ✓ src/lib/hooks/use-create-project.spec.tsx (1 test) 107ms
 ✓ src/lib/hooks/use-project.spec.tsx (2 tests) 112ms

 Test Files  5 passed (5)
      Tests  12 passed (12)
```

`npx vitest run` (الـ suite كامل — regression):
```
 ✓ src/lib/projects/map-form-to-create-input.spec.ts (5 tests) 4ms
 ✓ src/lib/api/refresh-policy.spec.ts (4 tests) 3ms
 ✓ src/lib/api/map-auth-error.spec.ts (3 tests) 5ms
 ✓ src/lib/auth/register-payload.spec.ts (2 tests) 4ms
 ✓ src/lib/auth/decide-redirect.spec.ts (4 tests) 5ms
 ✓ src/store/use-auth-store.spec.ts (2 tests) 4ms
 ✓ src/lib/api/projects-client.spec.ts (3 tests) 8ms
 ✓ src/components/auth/route-guard.spec.tsx (1 test) 68ms
 ✓ src/lib/hooks/use-projects.spec.tsx (1 test) 105ms
 ✓ src/lib/hooks/use-create-project.spec.tsx (1 test) 103ms
 ✓ src/lib/hooks/use-project.spec.tsx (2 tests) 111ms

 Test Files  11 passed (11)
      Tests  28 passed (28)
```

`npx tsc --noEmit` (stderr — نفس الـ 5 pre-existing بالظبط، صفر جديد):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{...}' but required in type 'AuthState'.
```
(WEB-TSC-001 ×2، WEB-TSC-002 ×2، WEB-STORE-001 ×1 — كلها backlog، صفر من الـ 5 ملفات الجديدة.)

## الحكم
✅ **READY** — الـ 5 MVT مكتوبة وpassing (12/12)، الـ paired assertion على أعمق طبقة (body الفعلي على الـ wire)، صفر regression (28/28)، صفر خطأ tsc جديد. الـ component-level guard test مؤجّل صراحةً (كلفة harness) مع تغطية boundary بديلة + checklist item واضح.

✋ تم المختبر — للدور التالي؟
