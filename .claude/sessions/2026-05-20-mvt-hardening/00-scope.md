# Scope — Session 1.6: MVT Hardening

> Session ID: `2026-05-20-mvt-hardening`
> النوع: Test hardening (no production code changes متوقعة)
> الـ input: 10 hacker findings (TEST-001 → TEST-010) من Session 1.5 (`2026-05-16-mvt-auth-users-companies/03-hacker-report.md`)

---

## المهمة
سد الـ 10 gaps في الـ MVT specs اللي اكتشفها هاكر Session 1.5 — الـ pattern الأساسي: **paired assertions** (verify primary action مع verify side-effect) + test variants ناقصة (fire-and-forget، null-path، ordering).

---

## الملفات المتأثرة

| الملف | الـ findings المعالجة | عدد التعديلات المتوقعة |
|---|---|---|
| `apps/api/src/modules/users/users.service.spec.ts` | TEST-001، TEST-002، TEST-005، TEST-006، TEST-007، TEST-010 | 4 تعديلات على specs موجودة + 3 specs جديدة |
| `apps/api/src/modules/auth/auth.service.spec.ts` | TEST-003، TEST-004، TEST-008 | 2 تعديل + 1 spec جديد |
| `apps/api/src/common/supabase/supabase-admin.provider.spec.ts` | TEST-009 | إعادة هيكلة (jest.mock للـ `@supabase/supabase-js`) |

**حدود التعديل:** test files فقط. **ممنوع** التعديل على أي production code في هذا الـ session. لو ظهر bug في الـ production code أثناء كتابة assertion → يُسجل كـ `NEEDS-CODER` للـ session تالي.

---

## الـ Services المتأثرة (per CLAUDE.md rule #5)

| Service / Provider | الـ Coverage Budget | السبب |
|---|---|---|
| **UsersService** | ≥6 specs محدّثة + 3 specs جديدة | TEST-001 (paired DB-write على A5 + CVE-USERS-004) + TEST-002 (password redaction على A4 ×2) + TEST-005 (tier-limit ordering — new spec) + TEST-006 (null supabaseAuthId — new spec) + TEST-007 (audit content على deactivate/activate ×2) + TEST-010 (create() distribution integration — new spec) |
| **AuthService** | ≥2 specs محدّثة + 1 spec جديد | TEST-003 (entityId assertions على A1 registerCompany) + TEST-004 (fire-and-forget — new spec) + TEST-008 (loginAttempts.recordFailure على wrong-credentials spec) |
| **SupabaseAdminProvider** | 1 spec محدّث (re-structured) | TEST-009 (createClient config: autoRefreshToken/persistSession assertions — يحتاج module mock) |
| **LoginAttemptsTracker** | ≥1 spec (existing — يُتحقق منه فقط) | TEST-008 يعتمد على الـ public API الموجود (`.check(email).failures`) — لا تعديل في الـ tracker spec نفسه |
| **CompaniesService** | **deferred to Session 1.7** | السبب: Session 1.5 scope ضيّعها؛ Session 1.6 narrowly scoped على الـ hacker findings فقط |
| **JwtStrategy** | **deferred to Session 1.7** | الـ remaining rejection paths مش في scope الـ hacker findings |

**الإجمالي المتوقع:** ~10 specs (4-5 modified + 4-5 new) — يتطابق مع الـ MVT budget الـ الـ Architect هيحدده في `00-plan.md` (1 spec لكل CVE-TEST-XXX).

---

## الـ Skills المستخدمة

- **`08-testing`** — الـ pattern الأساسي: paired assertions، test naming، mock fragility
- **`07-audit-compliance`** — فقرة "Redact sensitive fields" (TEST-002) + "entityId integrity" (TEST-003) + "audit content matches state" (TEST-007)
- **`03-auth-security`** — فقرة 12 lockout (TEST-008) + service-role client config (TEST-009)
- **`06-error-handling`** — fire-and-forget semantics (TEST-004)

---

## Hacker Mode (per CLAUDE.md rule #6)

🔴 **Mode: `attack-and-fix`** (الافتراضي)

- الهاكر مسموح يصلح inline لو في gap **داخل الـ test code نفسه** (e.g., assertion ناقصة، mock مكسور)
- الهاكر **ممنوع** يصلح inline لو الـ gap في production code → يلزم `NEEDS-CODER` ويوقف الـ session
- المبرر: Session 1.5 الهاكر كان `attack-only` لأن المستخدم منع تعديل code؛ في Session 1.6 الهدف **هو** كتابة assertions، فالـ inline fix على spec gaps logical extension

---

## الحدود (خارج نطاق هذا الـ session)

- ❌ أي تعديل على production code (services، DTOs، modules)
- ❌ CompaniesService specs (Session 1.7)
- ❌ JwtStrategy remaining rejection paths (Session 1.7)
- ❌ HTTP integration tests / supertest setup (Session 1.7)
- ❌ E2E suite (skeleton موجود — Phase 2 lateـ
- ❌ CVE-USERS-001 last-SUPER_ADMIN race condition (NEEDS-CODER backlog)
- ❌ `@prisma/client/runtime/library` → `@prisma/client` migration (NEEDS-CODER backlog)
- ❌ A7 permission catalog whitelist (NEEDS-CODER backlog)

---

## معايير النجاح للـ session

- [ ] كل واحد من الـ 10 TEST-XXX findings عنده spec assertion/variant جديد passing
- [ ] `pnpm --filter @saas-one/api test` يطلع green stdout (يتنسخ literal في `02-coder-report.md`)
- [ ] `pnpm --filter @saas-one/api tsc --noEmit` يطلع 0 errors
- [ ] الهاكر يـ re-attack ويلاقي ≤2 new gaps (لو لقى أكتر → الـ MVT pattern لسه مكسور)
- [ ] الـ principal يـ APPROVE بدون REJECTED

---

✋ تم الـ Scope — للدور التالي (🧠 المخطط)؟
