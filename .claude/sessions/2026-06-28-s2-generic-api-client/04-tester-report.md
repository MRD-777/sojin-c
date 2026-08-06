# تقرير المختبر — Session S2

> 🧪 المختبر — Standard mode. MVT إجباري (rule #2/#3): **test code فعلي مكتوب، مش checklist.** الـ budget من الـ plan (line 106): **3 specs** مكتوبة وpassing.

---

## إحصائيات

- **MVT المطلوب: 3 / المكتوب: 3** ✅ (متطابقين)
- Tests written (S2 الجديد): **5 assertions موزّعة على 2 spec files** (4 في refresh-policy + 1 integration في route-guard)
- Test files (إجمالي المشروع): 6 — Tests passing: **16 / 16** — failing: **0**
- Coverage: لا أداة coverage مفعّلة (مؤجّل — WEB-S1-004)؛ الـ MVT يغطي الـ 3 نقاط الحرجة صراحةً (أدناه).

---

## MVT — الربط بالـ Plan (line 106-109)

| # | مطلوب في الـ Plan | الـ Spec المكتوب | النتيجة |
|---|---|---|---|
| 1 | `shouldRefresh` → 401 fresh ⇒ **true** | `refresh-policy.spec.ts` › "returns true for a fresh 401" | ✅ |
| 2 | **deepest no-loop (rule #4):** `isRefreshCall=true` ⇒ false **و** `alreadyRetried=true` ⇒ false | `refresh-policy.spec.ts` › قسمين منفصلين (كل guard لوحده) + boundary (non-401/undefined) | ✅ |
| 3 | **paired assertion (rule #4):** RouteGuard على useMe error ⇒ `router.replace('/login')` **و** `store.clear()` حصل فعلاً (`accessToken===null`) **و** children مش معروضة | `route-guard.spec.tsx` (RTL+jsdom) — integration عبر الـ interceptor الحقيقي | ✅ |

---

## Unit Tests

| الـ Test | إيه اللي بيختبره | النتيجة |
|---------|-----------------|---------|
| `shouldRefresh` fresh 401 | 401 غير مُعاد وغير refresh-call ⇒ true | ✅ |
| `shouldRefresh` isRefreshCall | الـ 401 على الـ refresh نفسه ⇒ false (no loop) | ✅ |
| `shouldRefresh` alreadyRetried | بعد retry واحد ⇒ false (no loop) | ✅ |
| `shouldRefresh` boundary | 403/500/undefined ⇒ false | ✅ |

## Integration / Component Tests

### RouteGuard (`route-guard.spec.tsx`, RTL + jsdom)
| الحالة | المتوقع | النتيجة |
|--------|---------|---------|
| terminal 401 على `/users/me` (+ refresh فشل) | `router.replace('/login')` اتنادت | ✅ |
| terminal 401 (deepest) | الجلسة اتصفّت فعلاً: `accessToken` من `'tok'` → `null`، `user` → `null` | ✅ |
| terminal 401 | الـ protected children (`data-testid="protected"`) **مش** في الـ DOM | ✅ |

## Security Tests

| الهجوم | النتيجة |
|--------|---------|
| Refresh loop (refresh نفسه يرجّع 401) | ✅ مقفول — `isRefreshCall` guard (MVT #2) + الـ bare instance |
| Session leak بعد terminal-401 (children تظهر لغير مصرّح) | ✅ مقفول — children مش معروضة + جلسة مصفّاة (MVT #3) |
| Stale session بعد فشل الـ auth (CVE-S1-002) | ✅ مقفول — `store.clear()` فعلي عبر الـ interceptor (deepest) |

## Regression Tests
- الـ 11 spec القائمة من S1 (map-auth-error, decide-redirect, register-payload, use-auth-store): **11/11 ✅** — لا انحدار بعد إضافة المرحلة 1/2 والـ specs الجديدة.

---

## قرار تصميمي مهم — تسوية DP4 ↔ rule #4 (MVT #3)

**الـ plan فيه توتر داخلي:**
- **DP4 (line 83):** «الـ MVT يستخدم `vi.mock` على حدود الموديولات (`use-me`, router, store)» — أبسط.
- **MVT #3 (line 109):** لازم يثبت إن `store.clear()` **حصل فعلاً** (`accessToken===null`) — أعمق.

**المشكلة:** لو عملت shallow-mock لـ `useMe` عشان يرجّع `{isError:true}` وبس، فالـ guard (حسب DP1) **مابيصفّيش الجلسة** — الـ interceptor هو اللي بيصفّي. يبقى الـ `accessToken===null` هيـ pass **من غير ما الـ teardown الحقيقي يحصل** = بالظبط نمط الـ false-confidence اللي rule #4 موجود عشان يمنعه (درس CVE-TEST-011 في Session 1.6).

**القرار (honoring rule #4 = deepest primary action):** كتبت MVT #3 كـ **integration** يشغّل السلسلة الحقيقية:
`client.get('/users/me')` → 401 (transport-level adapter) → الـ **response interceptor الحقيقي** → refresh يفشل (spy) → الـ interceptor يعمل `terminateSession()` الفعلي (`store.clear` + `clearAuthHint`) → `useMe` يطلّع `isError` → الـ guard يعمل redirect.
الـ mock اتحصر في: **transport (axios adapter)** + **router** (محتاج Next context) + **`authClient.refresh`**. الـ `useAuthStore` والـ `client` interceptor **حقيقيين**. الـ token اتزرع `'tok'` قبل الـ render عشان نثبت إنه اتصفّى فعلاً (مش إنه كان null أصلاً).

هذا انحراف مبرَّر عن حرفية DP4 لكنه **التزام بـ rule #4** (قاعدة أقوى، hard rule). موثّق inline في الـ spec.

---

## Bugs اتكشفت أثناء الـ Testing
- لا bugs جديدة في كود المرحلة 1/2. الـ MVT #3 أكّد إن سلسلة CVE-S1-002 (route-guard + terminal teardown) شغّالة end-to-end.
- (مسجّل مسبقاً من المبرمج، تأكّد هنا) **WEB-STORE-001** — `setUser` phantom = خطأ tsc pre-existing فات على الـ Stage 1 report (4 معلَنة، 5 فعلية). **دخل BACKLOG.**

---

## Verification (literal — rule #8)

`npx vitest run` (كامل — 6 files / 16 tests، الـ 5 assertions الجديدة ضمنها):
```
 RUN  v3.2.6 D:/tampalets/saas-one/apps/web

 ✓ src/lib/api/map-auth-error.spec.ts (3 tests) 3ms
 ✓ src/lib/api/refresh-policy.spec.ts (4 tests) 4ms
 ✓ src/lib/auth/decide-redirect.spec.ts (4 tests) 5ms
 ✓ src/lib/auth/register-payload.spec.ts (2 tests) 5ms
 ✓ src/store/use-auth-store.spec.ts (2 tests) 5ms
 ✓ src/components/auth/route-guard.spec.tsx (1 test) 64ms

 Test Files  6 passed (6)
      Tests  16 passed (16)
   Start at  18:01:44
   Duration  14.70s (transform 428ms, setup 2.38s, collect 4.46s, tests 87ms, environment 9.42s, prepare 1.44s)
```

`npx tsc --noEmit` (stderr، EXIT 2 — نفس الـ 5 أخطاء pre-existing، **صفر من الـ spec files الجديدة**):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```
- الـ 5 كلها pre-existing (WEB-TSC-001 ×2 + WEB-TSC-002 NODE_ENV ×2 + WEB-STORE-001). لا `refresh-policy.spec.ts` ولا `route-guard.spec.tsx` يظهروا.

---

## مناطق لسه محتاجة coverage (مؤجّلة، مش blocker للـ MVT)

- **client.ts happy-path + refresh-success-retry:** MVT #3 غطّى الـ terminal branch. الـ branch التاني (401 → refresh **ينجح** → retry ينجح → data ترجع) لسه محتاج spec — يحتاج transport mock يرجّع 401 مرة ثم 200. **مرشّح WEB-S1-004.**
- **refresh stampede:** N طلبات متوازية ⇒ استدعاء `authClient.refresh` مرة واحدة (shared in-flight promise). منطق موجود، spec له مؤجّل.
- **useMe hydration success:** `data` ⇒ `store.user` اتحدّث (DP2). مؤجّل — MSW/transport-success mock (WEB-S1-004).
- **RouteGuard states:** `isLoading` (loading shell) و success (children تظهر) — مؤجّلين.

---

## الحكم

✅ **READY** — كل الـ 16 tests passing، الـ **MVT 3/3 مكتوب وpassing** (rule #2/#3 مستوفاة)، والـ paired assertion (MVT #3) على أعمق طبقة (rule #4) لا surface. صفر أخطاء tsc جديدة. الـ coverage المتبقي مؤجّل صراحةً لـ WEB-S1-004 (مش blocker).

- CVE-S1-002 / WEB-S1-001 (client route-guard) — **مقفول ومُختبَر end-to-end.**
- اكتشافان للـ BACKLOG (WEB-STORE-001 + WEB-TSC-002) مسجّلان.

✋ تم المختبر — للدور التالي؟
