# تقرير المختبر 🧪 — Session 1.6: MVT Hardening

> Session ID: `2026-05-20-mvt-hardening`
> الدور: 🧪 QA Guardian — verify the MVT-as-written فعلاً يحمي الـ invariants، وأضيف complementary coverage لـ gaps non-overlapping مع CVE-TEST-XXX المغلقة.
> Mode: test code فعلي (rule #2). تم إضافة **1 spec integration جديد** على Tester layer (لا تكرّر hacker fixes).
> Inputs: `02-coder-report.md` (12 MVT spec-units) + `03-hacker-report.md` (5 inline fixes + 1 new spec CVE-TEST-012 = 6 hacker spec-units) + Hacker توصيات.

---

## إحصائيات

| البند | القيمة |
|---|---|
| **MVT المطلوب (per Plan)** | **10 spec-units** (1 لكل CVE-TEST-XXX) |
| **MVT المكتوب من Coder** | **12 spec-units** (TEST-001 ×2 + TEST-002 ×2 + TEST-007 ×2 + الـ 7 الباقين) |
| **MVT المضاف من Hacker (inline + new)** | **6 spec-units** (4 inline assertions داخل specs موجودة + CVE-TEST-014 inline + CVE-TEST-012 new spec) |
| **MVT المضاف من Tester** | **1 spec-unit** (recordSuccess integration) |
| **MVT الإجمالي المكتوب الـ session** | **13 unique spec-units** (10 unique CVE-TEST + 1 hacker-new + 1 tester-new + 1 audit/state for activate/deactivate counted as separate من TEST-007 expansion) |
| **MVT delta vs budget** | **+3 above budget** (13 actual vs 10 planned) ✅ |
| **Tests written total** | جميع الـ specs في 4 spec files المعدّلة |
| **Tests passing** | **35/35** (12 users + 8 auth + 5 supabase + 10 tracker) |
| **Tests failing** | **0** |
| **Coverage على الـ services في scope** | UsersService = 12 specs / AuthService = 8 specs / SupabaseAdminProvider = 5 specs / LoginAttemptsTracker = 10 specs |
| **tsc errors جديدة** | **0** (الـ 4 pre-existing في `payments` + `updates` فقط — pre-existing) |

---

## الخريطة الكاملة — MVT spec-units مكتوبة عبر الـ session

| المصدر | CVE-TEST / Tag | الموقع | الحالة |
|---|---|---|---|
| Coder Phase 1 | TEST-001-A | `users.service.spec.ts` A5 updateMyProfile | ✅ passing |
| Coder Phase 1 | TEST-001-B | `users.service.spec.ts` CVE-USERS-004 update | ✅ passing |
| Coder Phase 1 | TEST-002-A | `users.service.spec.ts` A4 generated-password | ✅ passing |
| Coder Phase 1 | TEST-002-B | `users.service.spec.ts` A4 admin-supplied | ✅ passing |
| Coder Phase 2 | TEST-003 | `auth.service.spec.ts` A1 registerCompany | ✅ passing |
| Coder Phase 2 | TEST-004 | `auth.service.spec.ts` login fire-and-forget | ✅ passing |
| Coder Phase 2 | TEST-005 | `users.service.spec.ts` tier-limit ordering | ✅ passing |
| Coder Phase 3 | TEST-006 | `users.service.spec.ts` null-supabaseAuthId | ✅ passing |
| Coder Phase 3 | TEST-007-A | `users.service.spec.ts` deactivate audit | ✅ passing |
| Coder Phase 3 | TEST-007-B | `users.service.spec.ts` activate audit | ✅ passing |
| Coder Phase 4 | TEST-008 | `auth.service.spec.ts` lockout state | ✅ passing |
| Coder Phase 4 | TEST-009 | `supabase-admin.provider.spec.ts` config | ✅ passing |
| Coder Phase 4 | TEST-010 | `users.service.spec.ts` smoke charset | ✅ passing |
| Hacker re-attack | CVE-TEST-011 (inline في TEST-010) | `users.service.spec.ts` smoke + Supabase pw binding | ✅ passing |
| Hacker re-attack | CVE-TEST-012 (new spec) | `auth.service.spec.ts` multi-failure increment | ✅ passing |
| Hacker re-attack | CVE-TEST-013 (inline في TEST-006) | `users.service.spec.ts` paired DB+audit | ✅ passing |
| Hacker re-attack | CVE-TEST-014 (inline في TEST-009) | `supabase-admin.provider.spec.ts` client identity | ✅ passing |
| Hacker re-attack | CVE-TEST-015 (inline في TEST-003) | `auth.service.spec.ts` paired prisma.create | ✅ passing |
| **Tester (THIS REPORT)** | **TEST-LOCKOUT-SUCCESS-INTEG** (new spec) | `auth.service.spec.ts` recordSuccess integration | ✅ **passing** |

**Total = 19 hardening points** عبر 10 CVE-TEST findings الـ original + 6 hacker re-attacks + 1 tester complement. كلهم passing.

---

## Unit Tests

| الـ Test | إيه اللي بيختبره | النتيجة |
|---|---|---|
| `generateSecurePassword — 16 chars` | Length invariant | ✅ |
| `generateSecurePassword — charset` | Every char from documented PASSWORD_CHARSET | ✅ |
| `generateSecurePassword — uniform distribution` | No modulo bias، 10k samples، ±14% band | ✅ |
| `LoginAttemptsTracker — check() fresh email` | Returns zero state for unknown email | ✅ (pre-existing) |
| `LoginAttemptsTracker — check() case-insensitive` | Email normalization | ✅ (pre-existing) |
| `LoginAttemptsTracker — failures count up to 4 without locking` | Threshold invariant | ✅ (pre-existing) |
| `LoginAttemptsTracker — locks on 5th failure` | MAX_FAILURES boundary | ✅ (pre-existing) |
| `LoginAttemptsTracker — check() reports locked` | State propagation | ✅ (pre-existing) |
| `LoginAttemptsTracker — additional failures don't extend lock` | Idempotent lock window | ✅ (pre-existing) |
| `LoginAttemptsTracker — recordSuccess clears counter` | Reset invariant (unit) | ✅ (pre-existing) |
| `LoginAttemptsTracker — post-success, full 5 needed to lock` | Reset completeness | ✅ (pre-existing) |
| `LoginAttemptsTracker — lock expiry` | Time-based release | ✅ (pre-existing) |
| `LoginAttemptsTracker — isolation between users` | Multi-tenant safety | ✅ (pre-existing) |
| `SupabaseAdminProvider — env both present` | Happy path + client identity (CVE-TEST-014) | ✅ |
| `SupabaseAdminProvider — missing URL throws` | Fail-fast at boot | ✅ |
| `SupabaseAdminProvider — missing SERVICE_ROLE throws` | Fail-fast at boot | ✅ |
| `SupabaseAdminProvider — both missing throws` | Fail-fast at boot | ✅ |
| `SupabaseAdminProvider — stateless config passthrough` | TEST-009 config invariant | ✅ |

---

## Integration Tests

### AuthService.registerCompany (A1 audit + A8 error codes)

| الحالة | المتوقع | النتيجة |
|---|---|---|
| Happy path | 2 audit rows في $transaction، entityIds correct (TEST-003) + paired prisma.create assertions (CVE-TEST-015) | ✅ |
| Duplicate company email | `BusinessException(AUTH_BIZ_002)` + Supabase NOT called + audit NOT called | ✅ |
| Supabase non-conflict error | `SystemException(AUTH_SYS_001)` | ✅ |

### AuthService.login (lockout state machine + lastLogin)

| الحالة | المتوقع | النتيجة |
|---|---|---|
| Wrong credentials × 1 | `BusinessException(AUTH_BIZ_006)` + `failures === 1` (TEST-008) | ✅ |
| Wrong credentials × 2 (CVE-TEST-012) | `failures === 2` بعد call 2 → الـ counter increments | ✅ |
| Success path → lastLogin update | `prisma.user.update` called once + fire-and-forget pattern (TEST-004 lastLogin) | ✅ |
| Success path with rejected fire-and-forget | Login still resolves with accessToken (TEST-004) | ✅ |
| **Success after near-lockout (TESTER NEW)** | **`failures` resets from 4 → 0 + `locked === false`** | ✅ |

### UsersService.create (A4 + tier ordering + smoke)

| الحالة | المتوقع | النتيجة |
|---|---|---|
| Generated tempPassword path | Response shape + audit redaction (TEST-002-A) | ✅ |
| Admin-supplied password | No tempPassword echo + audit redaction (TEST-002-B) | ✅ |
| Tier limit rejected (TEST-005) | Supabase NOT touched + DB create NOT called | ✅ |
| Smoke charset × 20 (TEST-010 + CVE-TEST-011) | Charset/length + **password mirrored to Supabase** | ✅ |

### UsersService.update / updateMyProfile (audit selectivity + paired DB-write)

| الحالة | المتوقع | النتيجة |
|---|---|---|
| `updateMyProfile` with phone only (A5) | audit oldValues = `{phone}` only + paired `prisma.user.update.data === {phone}` (TEST-001-A) | ✅ |
| `update` with specialty+avatar (CVE-USERS-004) | audit oldValues = `{specialty, avatar}` + paired `prisma.user.update.data === {specialty, avatar}` (TEST-001-B) | ✅ |

### UsersService.deactivate / activate (A3 + audit content + null guard)

| الحالة | المتوقع | النتيجة |
|---|---|---|
| `deactivate` happy path (TEST-007-A) | Supabase ban=24h + audit `oldValues: {isActive: true}` + `newValues: {isActive: false}` | ✅ |
| `activate` happy path (TEST-007-B) | Supabase ban=none + audit oldValues/newValues mirrored | ✅ |
| `deactivate` legacy user (CVE-TEST-013 + TEST-006) | Supabase NOT called + DB update WAS called + audit WAS written | ✅ |

---

## Business Logic Tests

| الـ Invariant | المُختبَر | النتيجة |
|---|---|---|
| Tier limit BEFORE Supabase (TEST-005) | rejection prevents orphan auth users | ✅ |
| Fire-and-forget lastLogin (TEST-004) | DB failure does NOT block login | ✅ |
| Lockout counter increments (CVE-TEST-012) | 2 rejections → failures = 2 | ✅ |
| Lockout reset on success (Tester new) | 4 failures + login → failures = 0 | ✅ |
| Audit redaction (TEST-002) | password/tempPassword/supabaseAuthId NEVER في newValues | ✅ |
| Audit oldValues selectivity (A5/CVE-USERS-004) | scoped to changed fields only | ✅ |
| Audit entityId integrity (TEST-003) | company row → company.id، user row → user.id | ✅ |
| DB-write actually happens (TEST-001 + CVE-TEST-013 + CVE-TEST-015) | empty-`data` regression blocked | ✅ |

---

## Security Tests

| الهجوم | النتيجة |
|---|---|
| Audit log payload leak (TEST-002 × 2) | redaction asserted ✅ |
| Sensitive-payload echo on response (TEST-002-B) | admin-supplied password NOT echoed back ✅ |
| Lockout dead-code regression (CVE-TEST-012) | counter increment asserted ✅ |
| Lockout bypass via missing recordSuccess (Tester new) | reset asserted ✅ |
| Orphan Supabase auth user from tier-limit race (TEST-005) | ordering enforced ✅ |
| forensic entityId swap (TEST-003) | per-entity lookups assert ✅ |
| Service-role client misconfiguration (TEST-009) | createClient args asserted strictly ✅ |
| Service-role client identity substitution (CVE-TEST-014) | `client === createClient mock result` asserted ✅ |
| Password mirroring (CVE-TEST-011) | response.tempPassword === Supabase password asserted ✅ |
| Tenant isolation (LoginAttemptsTracker) | per-email lock، no cross-tenant ✅ (pre-existing) |

---

## Regression Tests

- ✅ `generateSecurePassword` 10k-sample distribution — pre-existing، still passing بعد all Phase 1-4 changes
- ✅ `LoginAttemptsTracker` 10 pre-existing specs — still passing بعد CVE-TEST-012 + Tester recordSuccess integration adds
- ✅ All 3 ts-jest warnings (`isolatedModules`) لسه موجودة — pre-existing، NEEDS-CODER backlog (tsconfig hardening)
- ✅ All 4 tsc errors (`@prisma/client/runtime/library`) لسه موجودة — pre-existing، NEEDS-CODER backlog (migration to `@prisma/client`)

---

## Bugs اتكشفت أثناء الـ Testing

**0 bugs جدد من الـ Tester layer.** الـ hacker re-attack كان شامل — الـ 6 findings الـ identified (CVE-TEST-011 → 016) كلها closed أو documented. الـ Tester وجد:

- **CVE-TEST-016** (audit hardcoded في activate/deactivate) — **production bug سبق توثيقه من الهاكر كـ NEEDS-CODER**. الـ Tester لا يكتب spec لإثباته (rule #6 + spec يثبت "production wrong" يحتاج production change). يُنقل للـ Session 1.7 backlog.

---

## مناطق لسه محتاجة coverage

### High priority (Session 1.7 candidates — beyond Session 1.6 scope)

1. **CompaniesService specs** — deferred من Session 1.5 scope. الـ `00-scope.md` Session 1.6 explicitly defers this.
2. **JwtStrategy remaining rejection paths** — deferred من Session 1.5.
3. **CVE-USERS-001 (last-SUPER_ADMIN race)** — في NEEDS-CODER backlog من Session 1.5.
4. **CVE-TEST-016 (activate/deactivate audit derived-from-state)** — production code change مطلوب أولاً، ثم spec.
5. **HTTP integration tests (supertest)** — Session 1.7 phase.

### Medium priority (process / extension)

6. **`updateMyProfile` empty-DTO edge case** — production builds `data: {}` + writes audit anyway. لو `prisma.user.update({data: {}})` يـ throw، الـ flow يكسر. Hacker mentioned، not added الـ Session 1.6 لـ keep scope tight.
7. **Lockout fires at 5th integration call + BIZ_001 thrown على 6th** — full state-machine integration. CVE-TEST-012 يـ probe الـ increment، الـ tracker unit specs يـ prove الـ lock fires، لكن الـ AuthService integration spec على الـ 5th-locks-6th-rejected scenario غير موجود.
8. **A4 admin-supplied password mirroring** — CVE-TEST-011 يحمي الـ generated path. الـ admin-supplied path يـ passes `dto.password` to Supabase؛ no spec يثبت ذلك حالياً. غير ضروري الآن (الـ admin already knows the password) لكن defense-in-depth.

### Low priority

9. **A7 permission catalog whitelist** — pre-existing NEEDS-CODER، unrelated to MVT hardening.
10. **`@prisma/client/runtime/library` → `@prisma/client` migration** — 4 tsc errors. unrelated to MVT، لكن CI-blocker للـ session لاحقة.

---

## Verification — Final test run

**jest stdout (literal — `npx jest <4 spec files> --no-coverage`):**

```
ts-jest[config] (WARN) message TS151002: Using hybrid module kind (Node16/18/Next) is only supported in "isolatedModules: true". (×4 — pre-existing)
[Nest] - LOG [AuthService] ✅ Company registered: "Acme Construction" [co-1] by alice@acme.test
[Nest] - ERROR [AuthService] Supabase auth creation failed for alice@acme.test
service unavailable
[Nest] - WARN [AuthService] Failed login attempt #1 for: al***@acme.test
[Nest] - WARN [AuthService] Failed login attempt #1 for: al***@acme.test
[Nest] - WARN [AuthService] Failed login attempt #2 for: al***@acme.test
[Nest] - ERROR [AuthService] Failed to update lastLogin
[Nest] - ERROR [AuthService] Error: DB unavailable
    at Object.<anonymous> (D:\tampalets\saas-one\apps\api\src\modules\auth\auth.service.spec.ts:328:42)
    ... (jest-circus internal frames trimmed)

Test Suites: 4 passed, 4 total
Tests:       35 passed, 35 total
Snapshots:   0 total
Time:        7.936 s, estimated 8 s
Ran all test suites matching src/modules/users/users.service.spec.ts|src/modules/auth/auth.service.spec.ts|src/common/supabase/supabase-admin.provider.spec.ts|src/modules/auth/login-attempts.tracker.spec.ts.
```

- ✅ **35 tests passed** = 12 (users) + 8 (auth، +1 Tester new) + 5 (supabase-provider) + 10 (login-attempts.tracker — pre-existing).
- ✅ Δ vs Hacker (24) = **+1 spec** (Tester recordSuccess integration) + 10 tracker (now included in run).
- ✅ الـ literal Nest log output يثبت إن الـ AuthService logger paths actually executed during tests — `Failed login attempt #1` (×2: TEST-008 + الـ first call of CVE-TEST-012)، `#2` (CVE-TEST-012 second call). `Failed to update lastLogin` = TEST-004 fire-and-forget. `✅ Company registered` = TEST-003 happy path.

**tsc stderr (literal — `npx tsc --noEmit` على `apps/api`):**

```
src/modules/payments/payments.service.spec.ts(20,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/payments/payments.service.ts(29,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.spec.ts(27,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.ts(36,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
```

- ✅ **0 new errors** من Tester spec. نفس الـ 4 pre-existing errors.

---

## Production-code zero diff (rule #6 enforcement)

- **Production code touched في Session 1.6: 0 files.**
- كل الـ 14 changes (Coder 13 modifications + Hacker 5 inline + Tester 1 new) on test files أو supporting test infrastructure exclusively.
- الـ NEEDS-CODER الوحيد (CVE-TEST-016) documented للـ Session 1.7، الـ Session 1.6 لم يتعداه.

---

## الحكم

✅ **READY** — كل الـ tests passing وcoverage كافي + MVT اتعمل وفوق الـ budget (13 vs 10 planned).

التفصيل:
- **MVT count: 13 spec-units / budget 10** — above budget، الـ Plan rule #2 (MVT obligatoire) متحقق فوق الحد الأدنى.
- **35/35 tests passing**، 0 failing، 0 new tsc errors.
- **Hacker findings 5/6 closed inline** — CVE-TEST-016 documented كـ NEEDS-CODER (production scope) + Tester قبول صريح.
- **Production code zero diff** — rule #6 attack-and-fix-on-test-code-only فُرض بنجاح عبر الـ 3 roles (Coder + Hacker + Tester).
- **Paired-assertion pattern enforced at depth** — الـ 13 spec-units تـ pair side-effect مع primary action، أو تـ pair شيء صراحة بدون hidden gap. الـ hacker re-attack أثبت ذلك بـ 5 inline-fixed gaps.
- **Skill 03 §12 lockout state machine** — covered بـ 3 integration touchpoints + 10 unit tests = comprehensive.
- **TEST-010 + CVE-TEST-011** — الـ CRITICAL gap الـ هاكر اكتشفه (smoke verifies response shape but not Supabase binding) closed cleanly.

**Recommendation للمراجع الأعلى:** الـ session جاهز للـ APPROVED. الـ CVE-TEST-016 NEEDS-CODER واضح ومُحدد المجال (Session 1.7).

---

✋ تم المختبر — للدور التالي (👁️ المراجع الأعلى)؟
