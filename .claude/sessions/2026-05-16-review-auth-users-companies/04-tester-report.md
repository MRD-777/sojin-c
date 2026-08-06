# تقرير المختبر 🧪

> Session: 2026-05-16-review-auth-users-companies
> الدور: 🧪 QA Engineer — Coverage audit + regression checklist
> فلسفة: لا أثق في أي كود ما اتغطاش بـ test يثبت سلوكه.

---

## إحصائيات

- Tests written this session: **0**
- Existing tests in scope (auth/users/companies): **23 passing**
- Coverage on touched code: **partial** — `LoginAttemptsTracker` + `TierLimitsService` فقط. الـ AuthService + UsersService + CompaniesService ما عندهمش specs على الإطلاق.

---

## Existing Test Inventory — Auth + Users + Companies

| ملف | Tests | يغطي إيه؟ | تأثير الـ session عليه |
|---|---|---|---|
| `auth/login-attempts.tracker.spec.ts` | ~15 tests | check/recordFailure/recordSuccess، lockout threshold، window TTL، eviction | ✅ يـ pass — لم نلمس الـ tracker |
| `companies/tier-limits.service.spec.ts` | ~8 tests | assertCanAddUser/Project/UseStorage، next-tier hint، MAX_SAFE_INTEGER bypass | ✅ يـ pass — لم نلمس الـ tier-limits |

**نتيجة `npx jest src/modules/auth/login-attempts.tracker.spec.ts src/modules/companies/tier-limits.service.spec.ts`:**
```
Test Suites: 2 passed, 2 total
Tests:       23 passed, 23 total
Time:        16.584 s
```

✅ **لا regression** — الـ existing tests كلها passing بعد التعديلات.

### Coverage Gaps الفعلية

| Module | Service spec | Controller spec | E2E |
|---|---|---|---|
| `auth/auth.service.ts` | ❌ غير موجود | ❌ | ❌ |
| `auth/auth.controller.ts` | ❌ | ❌ | ❌ |
| `auth/jwt.strategy.ts` | ❌ | — | ❌ |
| `users/users.service.ts` | ❌ غير موجود | ❌ | ❌ |
| `users/users.controller.ts` | ❌ | ❌ | ❌ |
| `companies/companies.service.ts` | ❌ غير موجود | ❌ | ❌ |
| `companies/companies.controller.ts` | ❌ | ❌ | ❌ |

**Verdict على الـ existing coverage:**
- ✅ Utility services (tracker، tier-limits) مغطاة
- ❌ Business logic services الـ 3 (Auth/Users/Companies) **بدون اختبارات** — هذا blocker حقيقي للـ production

---

## Test Plan — Regression Specs المطلوبة

أصنف الـ tests حسب الـ session deliverables. كل test يحمي إصلاح من الـ Plan أو الـ Hacker.

### A1 — `registerCompany` audit log

| الـ Test | إيه اللي بيختبره | الحالة |
|---|---|---|
| `registerCompany_audits_company_and_user_creation` | بعد ناجحة، الـ audit_logs عنده 2 rows: entityType=company.CREATE + entityType=user.CREATE، بنفس الـ correlation_id | ❌ لم يُكتب |
| `registerCompany_audit_failure_rolls_back_db` | mock الـ auditLog.logInTransaction يرمي → الـ Company.findFirst يرجع null بعد كده | ❌ |
| `registerCompany_rolls_back_supabase_on_db_failure` | mock prisma.$transaction يرمي → assert supabase.auth.admin.deleteUser تُنادى | ❌ |
| `registerCompany_redacts_sensitive_fields` | الـ audit row الـ newValues لا يحتوي supabaseAuthId ولا password | ❌ |

### A2 — `JwtStrategy.validate` لا يكتب على الـ DB

| الـ Test | إيه اللي بيختبره | الحالة |
|---|---|---|
| `JwtStrategy_does_not_call_prisma_user_update` | mock prisma.user.update → call .validate(...) → assert mock بـ 0 calls | ❌ |
| `JwtStrategy_returns_expected_payload_shape` | sub/email/userId/companyId/role/permissions موجودين | ❌ |
| `JwtStrategy_rejects_inactive_user` | user.isActive=false → throws UnauthorizedException | ❌ |
| `JwtStrategy_rejects_soft_deleted_company` | company.deletedAt set → throws | ❌ |
| `JwtStrategy_rejects_expired_subscription` | company.subscriptionStatus='EXPIRED' → throws | ❌ |

### A3 — `deactivate`/`activate` Supabase ban

| الـ Test | إيه اللي بيختبره | الحالة |
|---|---|---|
| `deactivate_bans_supabase_24h` | assert supabase.auth.admin.updateUserById called مع `{ ban_duration: '24h' }` | ❌ |
| `activate_unbans_supabase` | assert supabase.auth.admin.updateUserById called مع `{ ban_duration: 'none' }` | ❌ |
| `deactivate_skips_supabase_if_supabaseAuthId_null` | target.supabaseAuthId=null → supabase mock بـ 0 calls (لا errors) | ❌ |
| `deactivate_db_succeeds_when_supabase_ban_fails` | mock supabase يرمي → الـ DB row لسه isActive=false (best-effort) | ❌ |
| `softDelete_bans_supabase_100y` | `{ ban_duration: '876000h' }` | ❌ |

### A4 — Invite flow

| الـ Test | إيه اللي بيختبره | الحالة |
|---|---|---|
| `create_returns_tempPassword_when_admin_didnt_provide_one` | DTO بدون password → response.tempPassword.length===16، response.mustSharePasswordSecurely موجود | ❌ |
| `create_does_not_return_password_when_admin_provided_one` | DTO فيها password → response لا يحتوي tempPassword | ❌ |
| `create_rolls_back_supabase_on_db_failure` | mock prisma يرمي → supabase.deleteUser تُنادى | ❌ |
| `create_audit_redacts_password` | audit row الـ newValues لا يحتوي password ولا supabaseAuthId | ❌ |
| `create_enforces_tier_limit_before_supabase_call` | TierLimits يرمي → supabase.createUser بـ 0 calls (لا orphan) | ❌ |

### A5 — `updateMyProfile` audit log

| الـ Test | إيه اللي بيختبره | الحالة |
|---|---|---|
| `updateMyProfile_audits_changes_within_tx` | update + auditLog كلاهما في نفس الـ tx context | ❌ |
| `updateMyProfile_oldValues_only_contains_changed_fields` | DTO فيها phone فقط → oldValues = `{ phone: old }` فقط (مش name) | ❌ |
| `updateMyProfile_skips_audit_when_no_fields_change` | DTO فاضية → oldValues={} ✱ | ⚠️ ملاحظة: حالياً الـ implementation لسه بيـ commit empty tx (acceptable) |

### A6 — sortBy whitelist

| الـ Test | إيه اللي بيختبره | الحالة |
|---|---|---|
| `findAll_rejects_sortBy_supabaseAuthId` | query sortBy=supabaseAuthId → 400 من ValidationPipe | ❌ |
| `findAll_accepts_sortBy_name_email_role_createdAt_lastLogin` | كل من الـ 5 بـ HTTP 200 | ❌ |
| `findAll_default_sortBy_is_createdAt` | بدون query param → orderBy: { createdAt: 'desc' } | ❌ |

### A8 — AppException في Auth

| الـ Test | إيه اللي بيختبره | الحالة |
|---|---|---|
| `login_throws_AUTH_BIZ_006_on_wrong_credentials` | exception.code === 'AUTH_BIZ_006' | ❌ |
| `login_throws_AUTH_BIZ_001_when_locked` | بعد 5 محاولات: exception.code === 'AUTH_BIZ_001' | ❌ |
| `login_throws_AUTH_BIZ_007_on_soft_deleted_company` | code === 'AUTH_BIZ_007' | ❌ |
| `login_throws_AUTH_BIZ_003_on_expired_subscription` | code === 'AUTH_BIZ_003' | ❌ |
| `registerCompany_throws_AUTH_BIZ_002_on_duplicate_email` | code === 'AUTH_BIZ_002' | ❌ |
| `login_constant_time_message_for_email_enumeration` | unknown email vs known-email-wrong-pw → نفس الـ userMessage | ❌ |

### A9 — SupabaseAdminProvider

| الـ Test | إيه اللي بيختبره | الحالة |
|---|---|---|
| `SupabaseAdminProvider_throws_on_missing_env` | NEXT_PUBLIC_SUPABASE_URL=undefined → boot يرمي | ❌ |
| `AuthService_uses_injected_client` | provide mock via SUPABASE_ADMIN_CLIENT token → assert called | ❌ |
| `UsersService_uses_same_injected_client_as_AuthService` | nfs الـ instance | ❌ |

### Hacker fixes — Regression coverage

| الـ Test | إيه اللي بيختبره | الحالة |
|---|---|---|
| **CVE-USERS-004** `update_oldValues_includes_specialty_avatar_preferredLanguage` | DTO `{ specialty, avatar, preferredLanguage }` → oldValues يحتوي الـ 3 fields | ❌ |
| **CVE-USERS-004** `update_oldValues_excludes_unchanged_fields` | DTO `{ name: 'X' }` → oldValues = `{ name: oldName }` فقط (لا phone) | ❌ |
| **CVE-USERS-005** `generateSecurePassword_uniform_distribution` | 10,000 samples → كل char في الـ alphabet له frequency في `[140, 200]` (~1/62) | ❌ |
| **CVE-USERS-005** `generateSecurePassword_no_byte_modulo_bias` | الـ first 8 chars لا تظهر بـ probability أعلى من الـ rest | ❌ |
| **CVE-USERS-005** `generateSecurePassword_length_16` | output.length === 16 | ❌ |
| **CVE-USERS-001** `last_super_admin_concurrent_demote_race` | 2 concurrent changeRole → exactly one fails (يحتاج DB-level locking — حالياً سيـ fail) | ⚠️ سيكشف الـ race الحالي |

---

## Business Logic Tests (الـ state machines)

### Role transitions

| الـ Transition | مسموح؟ | اختبار موجود؟ |
|---|---|---|
| WORKER → PROJECT_MANAGER | ✅ (SUPER_ADMIN فقط يقدر) | ❌ |
| SUPER_ADMIN → WORKER (آخر super admin) | ❌ — Forbidden | ❌ |
| Self-role-change | ❌ — Forbidden | ❌ |

### User lifecycle transitions

| الـ Transition | مسموح؟ | اختبار موجود؟ |
|---|---|---|
| Active → Deactivated | ✅ | ❌ |
| Deactivated → Active | ✅ | ❌ |
| Active → Deactivated (self) | ❌ | ❌ |
| Active → SoftDeleted (last super admin) | ❌ | ❌ |
| SoftDeleted → Restored | غير مدعوم حالياً | — |

---

## Security Tests الموصى بها

| الهجوم | الـ Test | الحالة |
|---|---|---|
| Tenant isolation | SUPER_ADMIN من شركة A يحاول `findOne(userFromCompanyB)` → NotFound | ❌ |
| Privilege escalation | WORKER يبعت PATCH /users/{id} → 403 | ❌ |
| Mass-assignment | PATCH /users/me بـ `{ role: 'SUPER_ADMIN' }` → الـ ValidationPipe بـ forbidNonWhitelisted يرفض | ❌ |
| Mass-assignment | PATCH /companies/me بـ `{ subscriptionPlan: 'ENTERPRISE' }` → الـ ValidationPipe يرفض | ❌ |
| Double submit | POST /users بنفس الـ email في نفس الـ ms → الـ unique constraint يرفض الثاني (لكن orphan Supabase user يحتاج cleanup) | ❌ |
| Boundary values | sortBy="" → default إلى createdAt | ❌ |
| User enumeration | login بـ unknown email vs wrong password → نفس الـ response time + message | ❌ |
| Lockout DoS | 5 محاولات فاشلة على email → الـ 6 محاولة بـ TOO_MANY_REQUESTS | ❌ |

---

## Regression Tests على الـ Existing Features

- ✅ `LoginAttemptsTracker.spec`: 15 tests يـ pass — لم تتأثر
- ✅ `TierLimitsService.spec`: 8 tests يـ pass — لم تتأثر
- ⚠️ الـ existing tests **لا تغطي** الـ AuthService أو UsersService أو CompaniesService → فمفيش regression coverage فعلي للـ business logic

---

## Bugs اتكشفت أثناء الـ Testing (في الـ session دي)

كل اللي اتكشف من الهاكر (يُنظر إلى `03-hacker-report.md`):
- **CVE-USERS-001** — Last-SUPER_ADMIN race (NEEDS-CODER ⚠️)
- **CVE-USERS-004** — audit log oldValues incomplete (FIXED-BY-HACKER ✅)
- **CVE-USERS-005** — tempPassword modulo bias (FIXED-BY-HACKER ✅)
- **CVE-AUTH-006/007** — UX/operations issues (NEEDS-CODER ⚠️)
- **CVE-COMPANIES-010** — TierLimits race (NEEDS-CODER ⚠️)

---

## مناطق لسه محتاجة coverage

1. **AuthService** — 0 specs، لازم spec كامل (registerCompany، login، refresh، logout) — ~25 tests
2. **UsersService** — 0 specs، لازم spec كامل (create، update، updateMyProfile، changeRole، updatePermissions، deactivate/activate، softDelete، findAll، findOne) — ~30 tests
3. **CompaniesService** — 0 specs (updateCompany، updateSettings، getStorageUsage، getMyCompany) — ~10 tests
4. **JwtStrategy** — لا spec — ~5 tests (مهم بعد A2)
5. **E2E suite** — `test/app.e2e-spec.ts` فاضي — لا coverage حقيقية للـ HTTP-level

**Estimated effort:** ~70 specs لكل الـ 3 modules. session منفصل (يوم كامل).

---

## الحكم

❌ **NEEDS FIXES** — الـ session deliverables بنفسها سليمة (الكود يـ typecheck + الـ existing 23 tests يـ pass)، لكن **مفيش regression coverage** على أي من الـ 8 fixes اللي اتعملت.

### السبب:
- 0 specs مكتوبة هذا الـ session للـ AuthService/UsersService/CompaniesService
- الـ existing test specs (tracker + tier-limits) **لا تغطي** الـ services الرئيسية
- لو أي session لاحق كسر الـ audit log في `updateMyProfile` (مثلاً)، مفيش test هيـ catch ذلك

### التوصية للمراجع:
1. **APPROVED-WITH-CONDITION** على الـ session الحالية شريطة:
   - فتح session منفصل بأسرع وقت لإضافة الـ ~70 specs أعلاه
   - لا production deployment للـ Auth/Users/Companies endpoints بدون coverage
2. الـ NEEDS-CODER items من الهاكر (CVE-USERS-001، CVE-AUTH-007، CVE-COMPANIES-010) تُدخل في PLAN.md كـ P1
3. الـ pre-existing typecheck errors في payments/updates (`@prisma/client/runtime/library`) لازم تتصلح قبل إن jest يقدر يـ run الـ suite كاملة (`jest` بدون filter يفشل بسببها)

### Build State على الـ commit النهائي:
```
$ npx tsc --noEmit
# 4 errors في payments + updates (pre-existing — out of scope)
# 0 errors في auth + users + companies ✓

$ npx jest src/modules/auth/login-attempts.tracker.spec.ts src/modules/companies/tier-limits.service.spec.ts
Test Suites: 2 passed, 2 total
Tests:       23 passed, 23 total ✓
```
