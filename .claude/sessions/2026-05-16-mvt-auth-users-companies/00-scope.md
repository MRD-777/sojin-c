# Scope — Session 1.5 (MVT debt من Session 1)

## المهمة
كتابة الـ Minimum Viable Tests الناقصة من Session 1 (auth + users + companies) — 1 spec على الأقل لكل fix من الـ 6 phases + الـ 2 hacker fixes، عشان نقفل الـ regression-coverage debt اللي المختبر اعترف بيه في `04-tester-report.md` (سُجِّل ضعفه 3/10 على جودة الـ Tests).

## الـ Fixes اللي محتاجة MVT (من Session 1)

من `02-coder-report.md` (المرحلة → الـ finding):
- **A1** — `registerCompany` audit log داخل tx (Company.CREATE + User.CREATE)
- **A2** — `JwtStrategy.validate` لا يكتب على الـ DB
- **A3** — `deactivate`/`activate` يديروا Supabase ban (24h / none)
- **A4** — Invite flow: tempPassword conditional في الـ response
- **A5** — `updateMyProfile` audit log + oldValues snapshot للحقول المتغيرة فقط
- **A6** — `ListUsersQueryDto.sortBy` whitelist (`@IsIn([...])`)
- **A8** — AuthService بـ `AppException` hierarchy + error codes
- **A9** — `SupabaseAdminProvider` shared client

من `03-hacker-report.md`:
- **CVE-USERS-004** — `users.update` audit oldValues يشمل كل الحقول المتغيرة (مش name+phone بس)
- **CVE-USERS-005** — `generateSecurePassword` rejection sampling (لا modulo bias)

**المجموع: 10 fixes ⇒ MVT minimum = 10 specs.**

## الملفات المتأثرة (الـ test files المتوقّع كتابتها)

### Specs جديدة
- `apps/api/src/modules/auth/auth.service.spec.ts` — يغطي A1, A2 (عبر mock-then-assert)، A4 partial، A8
- `apps/api/src/modules/auth/jwt.strategy.spec.ts` — يغطي A2 (no DB write) + rejection paths
- `apps/api/src/modules/users/users.service.spec.ts` — يغطي A3, A4, A5, CVE-USERS-004, CVE-USERS-005
- `apps/api/src/modules/users/dto/list-users-query.dto.spec.ts` — يغطي A6 (validation level)
- `apps/api/src/common/supabase/supabase-admin.provider.spec.ts` — يغطي A9 (boot-time env validation)

### Test utilities (لو احتجنا)
- `apps/api/src/test-utils/prisma-mock.ts` — `createMockPrisma()` للـ specs اللي تحتاج Prisma
- `apps/api/src/test-utils/audit-log-mock.ts` — `createMockAuditLog()` لتـ assert على `logInTransaction` args
- `apps/api/src/test-utils/supabase-mock.ts` — `createMockSupabase()` لتـ assert على `auth.admin.*` calls

**ملاحظة:** الـ utilities دي tactical — لو لقينا duplication بسيطة في الـ specs، نـ extract. مش goal بحد ذاته.

## الـ Skills المستخدمة
- `08-testing` — patterns للـ service specs، mock isolation، assertion على audit context
- `03-auth-security` — للتحقق إن الـ tests تـ assert على الـ security invariants (constant-time message، ban duration)
- `06-error-handling` — للتـ assert على `code` field بدلاً من string matching الـ message

## الحدود (خارج نطاق هذا الـ session)

### مؤجل لـ sessions قادمة بقصد
- **Controller-level specs (HTTP layer)** — اقترحها المختبر، لكن service-level coverage هو الأولوية. الـ controllers رقيقة (forwarding للـ service).
- **E2E suite** — `test/app.e2e-spec.ts` لسه skeleton. Phase 1 P0 منفصل.
- **Specs على الـ existing CVEs الـ NEEDS-CODER** (CVE-USERS-001 race، CVE-AUTH-006/007، CVE-COMPANIES-010) — الإصلاح ذاته مؤجل، فمعنى الـ test ما تتعمل قبل الـ fix محدود (يبقى red-marked).
- **`@prisma/client/runtime/library` migration للـ payments/updates** — pre-existing typecheck blocker، يستحق session منفصل لأنه يلمس Decimal arithmetic.
- **الـ 70 spec الكاملة اللي اقترحها المختبر** — هذا الـ session للـ MVT الأساسية فقط. الـ tail (~60 spec) للـ session لاحق.

### خارج النطاق نهائياً
- أي تعديل على الـ Auth/Users/Companies business logic — هذا session للـ tests فقط. لو spec كشف bug، نوقف ونرجع للـ Plan.
- شراء أي test infrastructure جديدة (Vitest، Playwright) — Jest الموجود كافٍ.
- تعديل `jest.config` أو `tsconfig` — في الـ scope بس لو blocking.

## نقاط القرار المتوقّعة (للمخطط)
- D1: نكتب controller-level specs ولا نكتفي بـ service-level للـ MVT؟ (توصيتي: service-level فقط للـ session دي)
- D2: نـ extract test utilities من البداية ولا نـ inline mocks ونـ refactor لاحقاً؟ (توصيتي: inline أولاً، extract لو لقينا 2+ usage sites)
- D3: نتعامل مع الـ `@prisma/client/runtime/library` blocker لو منع `jest` من الـ run الكاملة، ولا نـ scope الـ jest بـ specific files؟ (توصيتي: scope بـ filters، الـ migration session منفصل)

## Definition of Done (الحد الأدنى)
- [ ] **MVT: 10 specs على الأقل مكتوبة وpassing** (إجباري — حد CLAUDE.md)
- [ ] 1 spec على الأقل لكل من الـ 8 plan fixes + 2 hacker fixes
- [ ] الـ existing 23 tests لسه passing (لا regression)
- [ ] الـ typecheck على الـ 3 modules + الـ specs الجديدة نظيف
- [ ] الـ specs الجديدة تـ run بـ `jest --testPathPattern='(auth|users|companies)'` بدون أن تتأثر بالـ payments/updates errors
