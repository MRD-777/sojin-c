# تقرير المختبر 🧪

> Session: 2026-05-16-mvt-auth-users-companies
> الدور: 🧪 QA Engineer
> فلسفة: مش بأثق في الكود ولا في الـ tests. الـ MVT تحقق — لكن الـ MVT minimum، مش maximum.

---

## إحصائيات

| المعيار | القيمة |
|---|---|
| **MVT المطلوب** (من 00-plan.md) | **10 specs minimum** (1 لكل fix) — 21 budgeted |
| **MVT المكتوب** | **46 tests على 5 spec ملفات جديدة + 1 smoke spec** ✅ |
| **MVT coverage الفعلية** | **10/10 fixes** ✅ — كل fix من Session 1 له ≥1 spec |
| Tests written this session | **46** (Session 1.5 net new) |
| Tests passing (in-scope total) | **69 / 69** ✅ (23 baseline + 46 new) |
| Tests failing | 0 |
| Existing 23 baseline regression | ✅ ثابت |
| Coverage على business logic touched | الـ 8 plan-fixes + 2 hacker fixes = **10/10** |
| Coverage gaps موثقة | 10 attack vectors من الهاكر — debt لـ Session 1.6 |

**هذا الـ session = أول session في حياة المشروع يـ pass الـ MVT floor الإجباري.** سابقاً (Session 1): 0 specs على الـ 3 services. الآن: 8 specs، 46 tests، 0 regressions.

---

## Unit Tests — الـ 8 spec ملفات

| الـ Spec | إيه اللي بيختبره | النتيجة |
|---|---|---|
| `test-utils/test-utils.spec.ts` | الـ 3 utilities (Prisma/AuditLog/Supabase mocks) — smoke على factories + `$transaction` aliasing + array form | ✅ 11/11 |
| `auth/login-attempts.tracker.spec.ts` | (baseline) check/recordFailure/recordSuccess + lockout threshold + window TTL + eviction | ✅ 15/15 |
| `companies/tier-limits.service.spec.ts` | (baseline) assertCanAddUser/Project/UseStorage + next-tier hint + MAX_SAFE_INTEGER bypass | ✅ 8/8 |
| `common/supabase/supabase-admin.provider.spec.ts` | **A9** — factory env validation: happy path + 3 failure paths | ✅ 4/4 |
| `users/dto/list-users-query.dto.spec.ts` | **A6** — sortBy whitelist via `@IsIn`: 6 allowed × `it.each` + 5 rejected × `it.each` + defaults + sortOrder | ✅ 14/14 |
| `users/users.service.spec.ts` | **CVE-005** distribution × 3 + **A3** deactivate/activate × 2 + **A4** create conditional × 2 + **A5** updateMyProfile × 1 + **CVE-004** update × 1 | ✅ 9/9 |
| `auth/jwt.strategy.spec.ts` | **A2** payload shape + no-DB-write (CORE) + inactive rejection | ✅ 3/3 |
| `auth/auth.service.spec.ts` | **A1** audit × 1 + **A8** error codes × 3 (BIZ_002 + SYS_001 + BIZ_006) + **A2-indirect** lastLogin × 1 | ✅ 5/5 |

---

## Integration Tests — الحالة

**لم تُكتب** أي integration / HTTP-level tests في هذا الـ session.

| الـ Endpoint | بدون token | token منتهي | role غلط | ownership غلط | input ناقص | input غلط | success |
|---|---|---|---|---|---|---|---|
| POST /auth/register | ❌ غير مغطى | ❌ | n/a | n/a | ❌ | ❌ | ❌ |
| POST /auth/login | ❌ | ❌ | n/a | n/a | ❌ | ❌ | ❌ |
| POST /auth/refresh | ❌ | ❌ | n/a | n/a | ❌ | ❌ | ❌ |
| POST /auth/logout | ❌ | ❌ | n/a | n/a | n/a | n/a | ❌ |
| GET /users | ❌ | ❌ | ❌ | n/a | ❌ | ❌ | ❌ |
| POST /users | ❌ | ❌ | ❌ | n/a | ❌ | ❌ | ❌ |
| PATCH /users/me | ❌ | ❌ | n/a | n/a | ❌ | ❌ | ❌ |
| PATCH /users/:id | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| POST /users/:id/deactivate | ❌ | ❌ | ❌ | ❌ | n/a | n/a | ❌ |
| GET /companies/me | ❌ | ❌ | n/a | n/a | n/a | n/a | ❌ |
| PATCH /companies/me | ❌ | ❌ | ❌ | n/a | ❌ | ❌ | ❌ |

**القرار:** Integration tests **خارج نطاق Session 1.5** (موثق في 00-scope.md). تـ deferred لـ Session 1.7 (HTTP-layer testing مع supertest + Nest TestingModule). الـ service-level coverage كأولوية أولى، لأنه الـ business logic + الـ side-effects.

---

## Business Logic Tests

### الـ Transitions المغطّاة

| الـ Transition | الـ spec | الـ assertion |
|---|---|---|
| Active → Deactivated (DB) | `users.service.spec.ts` A3 | tx.user.update + audit oldValues=true→false |
| Active → Deactivated (Supabase) | `users.service.spec.ts` A3 | updateUserById بـ ban_duration='24h' |
| Deactivated → Active (DB + Supabase) | `users.service.spec.ts` A3 | symmetric |
| profile self-edit (phone only) | `users.service.spec.ts` A5 | audit oldValues = `{phone: oldValue}` فقط |
| admin update (specialty + avatar) | `users.service.spec.ts` CVE-004 | audit oldValues يحتوي الـ 2 بالظبط |

### الـ Transitions الـ NOT-yet-covered

| الـ Transition | يحتاج spec في session لاحق |
|---|---|
| Active → SoftDeleted | softDelete spec (reason validation + Supabase ban 100y) |
| WORKER → PROJECT_MANAGER (changeRole) | changeRole spec |
| SUPER_ADMIN → WORKER (آخر super admin) | **CVE-USERS-001 race spec** — يحتاج fix أولاً (NEEDS-CODER من Session 1) |
| Self-role-change | changeRole self-prevention |
| Project state machine (DRAFT → IN_PROGRESS → COMPLETED) | خارج نطاق الـ 3 modules — Projects module |

---

## Security Tests

### المغطّاة

| الهجوم | الـ spec | الـ assertion |
|---|---|---|
| Ordering oracle (sortBy leak) | `list-users-query.dto.spec.ts` | `supabaseAuthId` و 4 أخرى مرفوضة بـ `isIn` constraint |
| User enumeration (login response) | `auth.service.spec.ts` AUTH_BIZ_006 | نفس الـ code للـ wrong-pw و unknown-email (assertion على `.code`، الـ message coupling مرفوض حسب skill 06) |
| Modulo bias في الـ password gen | `users.service.spec.ts` CVE-005 | distribution على 160k samples بـ ±14% tolerance |
| Env-missing على boot | `supabase-admin.provider.spec.ts` A9 | 3 failure paths كلها تـ throw FATAL |
| Audit gap على account creation | `auth.service.spec.ts` A1 | 2 audit rows داخل tx واحد |
| Audit gap على self-edit | `users.service.spec.ts` A5 | audit row + selective oldValues |
| JWT no-DB-write per request | `jwt.strategy.spec.ts` A2 | `prisma.user.update.not.toHaveBeenCalled` |

### الـ NOT-covered (debt من الهاكر — CVE-TEST-001 إلى TEST-010)

| الهجوم | الـ finding من الهاكر | الخطورة |
|---|---|---|
| **Password leak في audit newValues** | TEST-002 | 🔴 CRITICAL |
| **`data` payload bypass** (audit passes، DB ما يـ writeش) | TEST-001 | 🔴 CRITICAL |
| **entityId mix-up في audit** | TEST-003 | 🟡 HIGH |
| **lastLogin failure breaks login** (fire-and-forget violated) | TEST-004 | 🟡 HIGH |
| **Tier-limit bypass via ordering** | TEST-005 | 🟡 HIGH |
| **Null supabaseAuthId path crash** | TEST-006 | 🟡 MEDIUM |
| Audit content wrong في deactivate/activate | TEST-007 | 🟡 MEDIUM |
| Lockout silently disabled | TEST-008 | 🟢 LOW |
| Admin client config drift | TEST-009 | 🟢 LOW |
| post-processing على generated password | TEST-010 | 🟢 LOW |

**الإقرار:** الهاكر محق في كل الـ 10 findings. الـ tests الحالية تـ verify الـ **assertion exists** لكن مش الـ **invariant is fully protected**. التفصيل:

- **TEST-001 و TEST-002 catastrophic**: التركيز على side-effects (audit row content) خلّى الـ primary action assertions (الـ DB write payload، الـ password redaction) تـ slip. لما كتبت الـ A5/CVE-004 specs، التركيز كان "نثبت إن الـ oldValues صح" — وفعلاً الـ fix من Session 1 يتعلق بـ oldValues. لكن الـ test pattern الصح كان: "assertion على كل ما تـ change نتيجة الـ call" — مش بس الـ اللي اتـ fix.

- **TEST-004 الـ fire-and-forget**: كتبت "successful login يحدّث lastLogin مرة واحدة" لكن ما كتبتش "failed lastLogin update لا يمنع نجاح login". الـ A2 الـ design intent له طبقتين، اختبرت طبقة واحدة.

- **TEST-005 الـ tier-limit ordering**: A4 spec ركّز على الـ response shape (Q1=A behavior)، فاتني invariant آخر مهم (tier check قبل Supabase).

**هذه gaps real ومستحقة الـ severity rating.** مش defending — معترف بأن الـ MVT الحالي = floor، الـ ceiling أبعد منه بـ session كامل.

---

## Regression Tests

- ✅ الـ 23 tests الـ baseline من Session 1 لسه passing — لا regression
- ✅ الـ 11 smoke tests على الـ utilities — يحمي الـ infrastructure من bit-rot
- ✅ الـ 35 spec الجديدة (المراحل 2-5) — كلها regression nets على Session 1's 10 fixes

### الـ regression coverage per fix

| Fix | Tests الواقية | Strength |
|---|---:|---|
| A1 audit | 1 | ⚠️ medium — يفوّت entityId mix-up (TEST-003) |
| A2 no-DB-write | 4 | ✅ strong — coreassertion explicit |
| A2 lastLogin update | 1 | ⚠️ medium — يفوّت fire-and-forget (TEST-004) |
| A3 deactivate ban | 1 | ⚠️ medium — يفوّت audit content + null path (TEST-006, TEST-007) |
| A3 activate unban | 1 | ⚠️ medium — نفس الـ gaps |
| A4 generated tempPassword | 1 | ⚠️ medium — يفوّت password-in-audit (TEST-002) + tier ordering (TEST-005) |
| A4 admin-provided password | 1 | ⚠️ medium — نفس الـ gaps |
| A5 selective oldValues | 1 | ⚠️ medium — يفوّت data-write verification (TEST-001) |
| A6 sortBy whitelist | 14 | ✅ strong — `it.each` على كل القيم |
| A8 AppException codes | 3 | ✅ strong — `.code` assertions explicit |
| A9 env validation | 4 | ⚠️ medium — يفوّت client config (TEST-009) |
| CVE-USERS-004 selective oldValues | 1 | ⚠️ medium — يفوّت data-write (TEST-001) |
| CVE-USERS-005 modulo bias | 3 | ⚠️ medium — يفوّت `create()` integration (TEST-010) |

**التشخيص:** الـ "strong" specs (A2 core، A6، A8) يـ verify الـ invariant مباشرة. الـ "medium" specs يـ verify السلوك الأقرب للـ fix — لكن يفوتوا الـ side conditions اللي الـ implementation تعتمد عليها.

---

## Bugs اتكشفت أثناء الـ Testing

### في الكود (production)
- **0 bugs** — كل الـ 46 tests تـ pass من أول run. الـ implementation من Session 1 سليمة على المستوى اللي الـ tests تـ verify عليه.

### في الـ infrastructure (mocks)
- `TS7006: Parameter 'tx' implicitly has an 'any' type` — اكتشفه الـ smoke spec في المرحلة 1. اتصلح بـ exporting الـ `MockPrisma` type + annotation في الـ callback.

### في الـ tests نفسها (post-hoc by hacker)
- **10 attack vectors** — موثقة في `03-hacker-report.md`. كلها NEEDS-CODER (debt لـ Session 1.6).

---

## مناطق لسه محتاجة coverage

### P0 (لو في session 1.6 — MVT hardening)
1. **الـ 10 hacker findings** — assertions إضافية + 4 test variants. ~30 lines.
2. **الـ tx rollback semantics** — spec يثبت إن لو الـ audit row فشل → الـ DB write يـ rollback. يحتاج تـ deepen الـ `$transaction` mock أو Prisma test container.

### P1 (sessions لاحقة)
3. **CompaniesService specs** (0 currently) — updateCompany، updateSettings، getStorageUsage
4. **JwtStrategy remaining rejection paths** — user not found، company.deletedAt، subscriptionStatus='EXPIRED'، empty sub
5. **AuthService.refreshToken و logout** — 0 specs currently
6. **Controller-level (HTTP) specs مع supertest** — كل الـ table الفاضي في "Integration Tests" أعلاه

### P2
7. **changeRole + updatePermissions specs** على UsersService — 0 currently
8. **softDelete spec** — reason validation + ban 100y + ensureNotLastSuperAdmin
9. **CVE-USERS-001 race spec** — يحتاج الـ fix أولاً (NEEDS-CODER من Session 1)

### P3
10. **E2E suite** (`test/app.e2e-spec.ts` skeleton) — full HTTP flow

**Estimated total effort لـ كل الـ tail:** 4-6 sessions × half-day each. الـ ~60-80 spec.

---

## الحكم

✅ **READY — للـ MVT floor**

الـ session deliverable الأساسي تحقق:
- **MVT: 10/10 fixes covered** ✅
- 46 tests جديدة، 0 failures، 0 regressions
- الـ test infrastructure (utilities + smoke) بـ DRY-clean ومـ reusable
- الـ build clean على الـ scope (الـ 4 pre-existing payments/updates errors خارج النطاق)

**لكن مع condition صريحة:**

⚠️ **CONDITION — قبل أي production deployment على الـ 3 modules:**

1. **Session 1.6 (MVT hardening)** — تنفيذ الـ 10 hacker findings:
   - TEST-001 و TEST-002 (CRITICAL) — لا يجب أن يبقوا مفتوحين في production. الـ password-in-audit gap هو **compliance regression** لو حصلت.
   - TEST-003 إلى TEST-005 (HIGH) — forensic + availability + ordering invariants.
   - TEST-006 إلى TEST-010 (MEDIUM/LOW) — defensive coding.

2. **Meta-pattern adoption في Plan template** — لما الـ المخطط يـ scope MVT في sessions جاية، الـ pattern الإجباري:
   > كل audit assertion **لازم** يقترن بـ DB-write assertion.
   > كل side-effect assertion **لازم** يقترن بـ primary-action assertion.

   لو الـ pattern ده طُبق في Session 1.5، كان TEST-001 و TEST-002 ما حصلوش.

3. **CompaniesService specs** قبل أي UI integration على endpoints الـ companies — حالياً 0 coverage.

---

### إقرار صريح

الـ MVT الـ 10/10 = الـ floor، مش الـ ceiling. الـ tests الحالية تـ catch الـ obvious regressions (الـ A1 audit ما يحصلش، الـ JwtStrategy يكتب على الـ DB، الـ sortBy يقبل supabaseAuthId) — لكن **يفوتوا الـ subtle bugs** اللي الهاكر استخرجها (password leak، data payload empty، fire-and-forget violated).

الـ Session 1.5 = **massive net upgrade** من Session 1 (من 0 specs إلى 46 + utilities). لكن **مش endpoint** — هي milestone أول على طريق أطول.

✋ تم المختبر — للدور التالي (👁️ المراجع الأعلى)؟
