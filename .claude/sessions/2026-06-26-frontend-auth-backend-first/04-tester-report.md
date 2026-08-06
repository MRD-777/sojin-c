# تقرير المختبر — Session S1

> 🧪 QA Guardian — MVT فعلي (test code، مش checklist) بـ vitest. rule #2/#3.

---

## إحصائيات
- **MVT المطلوب: 5 / المكتوب: 5** ← ✅ متطابقين
- Test files: 4
- Tests written: 11 (5 MVT + 6 بونص/edge)
- Tests passing: **11**
- Tests failing: 0
- Coverage: pure functions + store الخاصة بطبقة الـ auth (4 وحدات: store، register-payload، decide-redirect، map-auth-error)

---

## الـ MVT (الحد الأدنى الإجباري) — 5/5

| # | المصدر | الـ Spec | الملف | النتيجة |
|---|--------|---------|-------|---------|
| 1 | هاكر CVE-S1-001 (re-attack، rule #5) | `setSession` يمسح `pendingRegistration` مربوطاً بنفس الـ session set | `store/use-auth-store.spec.ts` | ✅ |
| 2 | plan + هاكر vector #3 | `buildRegisterPayload` → 6 حقول بالظبط + **غياب `role`** | `lib/auth/register-payload.spec.ts` | ✅ |
| 3 | plan تعريف النجاح #2 | `decideAuthRedirect` no-hint+dashboard ⇒ login **في كل البيئات** (غياب فرع NODE_ENV) | `lib/auth/decide-redirect.spec.ts` | ✅ |
| 4 | plan MVT #3 | `mapAuthError` → `{code,message,requestId}` من envelope + NETWORK fallback | `lib/api/map-auth-error.spec.ts` | ✅ |
| 5 | plan MVT #4 | `useAuthStore` → `clear()` يصفّر accessToken + user + pendingRegistration | `store/use-auth-store.spec.ts` | ✅ |

### Paired / deepest assertions (rule #4) — تطبيق صريح
- **MVT #1:** مش بس «pendingRegistration === null» — الـ spec يثبت **الأولوية**: precondition إن الـ plaintext password فعلاً في الذاكرة (`password === "Secret!12345"`)، ثم بعد `setSession` يتأكّد إن المسح حصل **كأثر جانبي لتأسيس الجلسة نفسها** + الـ session اتظبط في نفس العملية. ده يقفل نمط الهاكر (secret يعيش عبر الجلسات) عند أعمق primary action.
- **MVT #2:** مش بس «فيه الحقول الصح» — `expect("role" in out).toBe(false)` + `Object.keys(out).sort()` يثبت **حصرياً** إن مفيش قناة لتسريب role (أعمق من «الحقول موجودة»).
- **MVT #3:** مش بس «يرجّع string» — loop على `["development","production","test"]` يثبت إن النتيجة **نفسها** بغضّ النظر عن `NODE_ENV` → دليل تشغيلي على غياب الفرع اللي كان bug في الـ middleware القديم.

---

## Unit Tests (التفصيل)

| الـ Test | إيه اللي بيختبره | النتيجة |
|---------|-----------------|---------|
| store: setSession wipes pendingRegistration | CVE-S1-001 paired assertion | ✅ |
| store: clear() zeroes everything | MVT #5 | ✅ |
| payload: 6 fields + no role | MVT #2 paired | ✅ |
| payload: omits companyPhone when absent | edge (لا empty-string للـ DTO) | ✅ |
| redirect: no-hint+dashboard ⇒ login (×3 envs) | MVT #3 paired | ✅ |
| redirect: hint+auth ⇒ dashboard | فرع تاني | ✅ |
| redirect: unknown locale ⇒ defaultLocale | edge (locale fallback) | ✅ |
| redirect: dashboard+hint ⇒ null | لا redirect غير ضروري (يغطّي N1 جزئياً) | ✅ |
| mapError: envelope ⇒ code+message+requestId | MVT #4 | ✅ |
| mapError: request بلا response ⇒ NETWORK | MVT #4 fallback | ✅ |
| mapError: غير كده ⇒ UNKNOWN | edge | ✅ |

---

## Security Tests (مربوطة بهجمات الهاكر)
| الهجوم | الـ spec المقابل | النتيجة |
|--------|------------------|---------|
| Credential leakage عبر الجلسات (CVE-S1-001) | store: setSession wipes pendingRegistration | ✅ مقفول |
| Privilege escalation عبر role injection (vector #3) | payload: no role + key whitelist | ✅ مقفول |
| Auth bypass عبر NODE_ENV dev-branch | redirect: ×3 environments | ✅ مقفول |

---

## Verification (literal)

### `npx vitest run`
```
 RUN  v3.2.6 D:/tampalets/saas-one/apps/web

 ✓ src/lib/api/map-auth-error.spec.ts (3 tests) 5ms
 ✓ src/lib/auth/decide-redirect.spec.ts (4 tests) 5ms
 ✓ src/lib/auth/register-payload.spec.ts (2 tests) 6ms
 ✓ src/store/use-auth-store.spec.ts (2 tests) 3ms

 Test Files  4 passed (4)
      Tests  11 passed (11)
   Start at  19:44:19
   Duration  1.69s
```

### `npx tsc --noEmit`
```
tsc error count: 2
(الـ 2 pre-existing فقط: permissions/page.tsx 'cn' + dropdown-menu — WEB-TSC-001)
zero NEW errors
```

---

## Bugs اتكشفت أثناء الـ Testing
- لا يوجد. كل الـ specs عدّت من أول تشغيل؛ سلوك الوحدات مطابق للتصميم.

## مناطق لسه محتاجة coverage (مؤجّلة — مش MVT)
- **الصفحات (login/register/setup) كـ component tests** — تحتاج jsdom + React Testing Library (مش متوفرة في vitest config الحالي — node فقط). مؤجّل لـ S2 test-infra.
- **`auth-client` HTTP layer** — يحتاج axios mock / MSW؛ مؤجّل (S2).
- **`useLogin/useRegister/useLogout` hooks** — تحتاج React renderer؛ المنطق الحساس (مسح الـ secret) متغطّى عند طبقة الـ store بدلاً منها (أعمق نقطة).
- **N1 (segment-aware redirect)** — متغطّى جزئياً بـ spec «dashboard+hint ⇒ null»؛ الـ hardening الكامل في S2.

## الحكم
✅ **READY** — كل الـ 11 tests passing، الـ MVT 5/5 مكتوب وأخضر، الـ paired assertions مطبّقة على الـ 3 MVT الأمنية (rules #2/#3/#4). صفر أخطاء tsc جديدة. الـ coverage المؤجّل موثّق وغير حرج لـ S1 (طبقة pure logic + store هي السطح الحسّاس وكلها مغطّاة).

✋ تم المختبر — للدور التالي (👁️ المراجع الأعلى)؟
