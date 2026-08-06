# تقرير الهاكر 🔴

> Session: 2026-05-16-review-auth-users-companies
> الدور: 🔴 Red Team — Penetration Test
> الهدف: إثبات أن الكود فيه ثغرات. مش إثبات إنه آمن.

---

## Attack Vectors المفحوصة

- [x] Authentication bypass — كل routes خلف global `JwtAuthGuard` ما عدا `@Public()`
- [x] Authorization (IDOR, privilege escalation) — `@Roles()` decorator + tenant scoping
- [x] Input validation (injection, overflow) — DTOs strict + `forbidNonWhitelisted: true`
- [x] Tenant isolation — كل query فيها `companyId: user.companyId`
- [x] Business logic abuse — state machines + invariants
- [x] Double submit / race conditions — على `ensureNotLastSuperAdmin` و `TierLimits` و register
- [x] File upload exploits — N/A لهذه الـ session
- [x] Audit log tampering — append-only enforced بـ DB triggers (per CLAUDE.md)
- [x] Session management — Supabase JWT + httpOnly refresh cookie
- [x] User enumeration — login response, lockout response

---

## الثغرات المكتشفة

### [CVE-USERS-001] Last-SUPER_ADMIN guard فيه TOCTOU race
- **الخطورة:** MEDIUM
- **الموقع:** `users.service.ts:661-677` (`ensureNotLastSuperAdmin`) — مستخدمة في `changeRole`, `deactivate`, `softDelete`
- **السيناريو:**
  1. الشركة عندها 2 SUPER_ADMIN: A و B.
  2. Admin A يبعت `POST /users/{B}/deactivate` في T=0
  3. Admin C (admin تالت اتدعى من قبل) يبعت `POST /users/{A}/deactivate` في T=0+5ms
  4. Request 1: `ensureNotLastSuperAdmin(B)` → يـ count بقية الـ SUPER_ADMINs الـ active (= A فقط، count=1) → يـ pass
  5. Request 2: `ensureNotLastSuperAdmin(A)` → يـ count بقية الـ SUPER_ADMINs (= B فقط لأن request 1 ما committed لسه، count=1) → يـ pass
  6. الـ transactions تـ commit → 0 SUPER_ADMINs active في الشركة → الشركة مقفولة
- **التأثير:** Self-DoS — مفيش حد يقدر يدير الشركة بدون DB intervention. Recoverable لكن مزعج جداً.
- **الإصلاح المطبق:** **NEEDS-CODER ⚠️** — يحتاج تغيير معماري:
  - Option 1: `SERIALIZABLE` isolation level على الـ transaction
  - Option 2: explicit row lock على الـ company row (`SELECT FOR UPDATE`) عند تعديل أي SUPER_ADMIN status
  - Option 3: DB-side check constraint / trigger يضمن `count(SUPER_ADMIN active) >= 1` per company
  - **توصيتي:** Option 3 (DB constraint) — invariant على مستوى الـ DB، مش الـ app. أبعد من race conditions.
- **الحالة:** NEEDS-CODER ⚠️ — مؤجل لـ session منفصل (يحتاج migration)

---

### [CVE-AUTH-002] Account-lockout-as-DoS (anyone can lock anyone's email)
- **الخطورة:** LOW (mitigated)
- **الموقع:** `login-attempts.tracker.ts:92-120` + `auth.service.ts:236-244`
- **السيناريو:**
  1. Attacker يعرف الـ email الـ public لـ SUPER_ADMIN (موجود على الـ landing page مثلاً)
  2. يبعت 5 login attempts بـ passwords غلط على `target@company.com`
  3. الـ tracker يقفل الـ email لـ 15 دقيقة
  4. الـ SUPER_ADMIN الحقيقي ما يقدرش يدخل لـ 15 دقيقة
  5. الـ attacker يكرّر كل 15 دقيقة → permanent lockout
- **التأثير:** Targeted DoS على specific user.
- **Mitigation موجود:**
  - `@nestjs/throttler` global على `/auth/login`: 5 req/min per IP. الـ attacker يحتاج 5 IPs مختلفة عشان يقفل user واحد.
  - الـ retry-after في الـ response message يحذّر المستخدم.
- **الإصلاح المقترح (defense-in-depth):**
  - CAPTCHA بعد 3 failures (لو in-house) — out of scope هذه الـ session
  - شيل الـ retry-after من الـ response message للـ public — لا تخبر الـ attacker إن الـ lockout نجح (لا تـ leak الـ state)
  - **القرار:** السلوك الحالي مقبول للـ Phase 1 (الـ throttler يكفي). يحتاج CAPTCHA لـ Phase 2.
- **الحالة:** ACCEPTED-WITH-MITIGATION ✓ (موثق، الـ throttler يكفي)

---

### [CVE-USERS-003] tempPassword generation modulo-bias
- **الخطورة:** LOW
- **الموقع:** `users.service.ts:682-689` (`generateSecurePassword`)
- **السيناريو:**
  1. الـ password generation: `randomFillSync(Uint8Array(16))` ثم `chars[byte % 62]`
  2. `256 % 62 = 8` → الـ bytes 248-255 (8 من 256) تـ map للـ chars 0-7 (الـ uppercase A-H)
  3. النتيجة: الـ chars الأولى (A-H) عندها probability 5/256 (~1.95%) بدلاً من 4/256 (~1.56%)
  4. الـ entropy الفعلي للـ 16-char password: ~95.0 bits بدلاً من 95.3 (الـ ideal)
- **التأثير:** Cryptographic — minor entropy loss. الـ password لسه strong (>80 bits)؛ لكن الـ pattern قابل للكشف لو الـ attacker حصل على hundreds من tempPasswords.
- **الإصلاح المطبق:** **NEEDS-CODER ⚠️** — استبدال `byte % 62` بـ rejection sampling:
  ```typescript
  // Reject bytes that would bias the distribution.
  const MAX_VALID = Math.floor(256 / chars.length) * chars.length; // 248
  // Loop until we have a byte in [0, MAX_VALID)
  ```
- **الحالة:** NEEDS-CODER ⚠️ — تعديل بسيط لكنه خارج الـ 6 phases المتفق عليها

---

### [CVE-USERS-004] `users.update` audit row فيه oldValues ناقصة
- **الخطورة:** LOW
- **الموقع:** `users.service.ts:330-351` (`update` method)
- **السيناريو:**
  1. الـ admin يـ update user عبر `PATCH /users/{id}` مع body: `{ specialty: 'Architect', avatar: 'https://...', preferredLanguage: 'EN' }`
  2. الـ data payload يحتوي على الـ 3 fields
  3. الـ audit row الـ oldValues مكتوبة كـ `{ name: target.name, phone: target.phone }` — **بس!**
  4. النتيجة: في الـ forensics لاحقاً، الـ specialty/avatar/preferredLanguage التاريخية مش متسجلة في الـ oldValues
- **التأثير:** Audit/compliance — gap في الـ trail. لو حصل dispute "إن الـ user specialty اتغيرت من X إلى Y"، الـ audit row ما يحتفظش بالـ X.
- **الإصلاح المطبق:** **FIXED-BY-HACKER ✅** — snapshot الـ oldValues عبر الـ 5 fields القابلة للتغيير (name, phone, specialty, avatar, preferredLanguage)، فقط للحقول الموجودة في `data`.

**التعديل (`users.service.ts:331-342`):**
```typescript
const oldValues: Record<string, unknown> = {};
if (data.name !== undefined) oldValues.name = target.name;
if (data.phone !== undefined) oldValues.phone = target.phone;
if (data.specialty !== undefined) oldValues.specialty = target.specialty;
if (data.avatar !== undefined) oldValues.avatar = target.avatar;
if (data.preferredLanguage !== undefined)
  oldValues.preferredLanguage = target.preferredLanguage;
```
- **الحالة:** FIXED-BY-HACKER ✅

---

### [CVE-USERS-005] tempPassword modulo bias — FIXED INLINE
- **الخطورة:** LOW (نفس CVE-USERS-003 لكن مع fix)
- **القرار:** الـ fix بسيط جداً (~10 lines) ولا يحتاج architecture change → طبقته inline بدل ما أتركه لـ NEEDS-CODER.
- **الإصلاح المطبق:** **FIXED-BY-HACKER ✅** — rejection sampling في `users.service.ts:695-723`:
  ```typescript
  const maxValid = Math.floor(256 / charsetSize) * charsetSize; // 248 for 62
  // Loop: refill buffer, reject bytes >= maxValid, use byte % 62 on the rest.
  ```
- النتيجة: distribution موحدة تماماً عبر الـ 62 char. Worst-case rejection: 3% (لا يؤثر على الـ throughput).
- **الحالة:** FIXED-BY-HACKER ✅

---

### [CVE-AUTH-006] `logout` requires JWT — expired-token user can't logout
- **الخطورة:** LOW (UX، ليس security)
- **الموقع:** `auth.controller.ts:142-161` — `logout` ليس `@Public()`
- **السيناريو:**
  1. User يدخل، الـ access token expires بعد 15 دقيقة
  2. User يضغط Logout
  3. الـ global `JwtAuthGuard` يرفض الـ request بـ 401 لأن الـ access token expired
  4. الـ refresh cookie لسه موجود → الـ user مش "fully logged out" من perspective الـ browser
- **التأثير:** UX — الـ frontend لازم يـ try-then-refresh-then-retry. الـ refresh cookie سيتـ rotate لاحقاً (7 أيام) أو الـ user يقفل الـ tab.
- **الإصلاح المقترح:** **NEEDS-CODER ⚠️** — جعل `logout` `@Public()` (الـ refresh cookie + best-effort Supabase signOut هما الـ guarantees، مش الـ JWT).
- **الحالة:** NEEDS-CODER ⚠️ — مؤجل (UX issue، ليس critical)

---

### [CVE-AUTH-007] Supabase orphan user عند فشل rollback في register race
- **الخطورة:** LOW
- **الموقع:** `auth.service.ts:75-217` — `registerCompany`
- **السيناريو:**
  1. Concurrent registration بنفس الـ companyEmail من 2 clients
  2. كلاهما يـ pass `validateRegistration` (لا row بعد)
  3. كلاهما يخلق Supabase user (Supabase يقبلهم لو الـ adminEmail مختلف، أو يرفض الثاني لو نفس الـ adminEmail)
  4. الحالة المثيرة: adminEmail مختلف بس companyEmail نفسه:
     - كلاهما ينجح في Supabase
     - الـ DB insert الأول ينجح
     - الـ DB insert الثاني يفشل على constraint `Company.email` unique
     - الـ catch block يـ delete الـ Supabase user الثاني ✓
  5. لكن لو الـ Supabase rollback فشل (network glitch): orphan Supabase user (الـ logger يطبع `🔴 CRITICAL: Manual cleanup required`)
- **التأثير:** Operations — admin يحتاج cleanup script يدوي. لا security impact مباشر.
- **الإصلاح المقترح:** **NEEDS-CODER ⚠️** — Outbox pattern: write the "Supabase user to delete" intent in DB، الـ background worker يـ retry حتى يتأكد من الـ deletion.
- **الحالة:** NEEDS-CODER ⚠️ — مؤجل (Operations issue، يحتاج NotificationsModule + worker)

---

### [CVE-USERS-008] `updateMyProfile` لا يفلتر بـ companyId في الـ tx update
- **الخطورة:** INFO (لا exploit)
- **الموقع:** `users.service.ts:165` — `tx.user.update({ where: { id: user.userId }, ... })`
- **السيناريو:** الـ `where` بـ `id` فقط، بدون `companyId`. تقنياً، لو الـ JWT اتـ tampered وعنده `userId` من شركة تانية... لكن:
  - الـ `userId` global unique (UUID) — لا collision
  - الـ JwtStrategy يـ verify الـ JWT بـ secret + يقرا الـ user من الـ DB ويـ build الـ payload — `userId` الفعلي بييجي من الـ DB، مش من الـ payload
  - فالـ `userId` في الـ JWT هو الـ id الـ DB-side للـ user الـ verified
- **التأثير:** لا exploit. مجرد best-practice gap — defense-in-depth.
- **الإصلاح المقترح:** ضيف `companyId: user.companyId` في الـ where (defensive). لا blocking.
- **الحالة:** ACCEPTED ✓ (موثق، لا blocking)

---

### [CVE-USERS-009] `activate` لا يـ check `ensureNotLastSuperAdmin` (ليست ثغرة فعلاً)
- **التحليل:** `activate` يـ flip `isActive: false → true`. لو الـ user كان SUPER_ADMIN deactivated، الـ activate يعيده. لا حالة فيها activate تكسر invariant.
- **الحالة:** NOT-A-BUG ✓ (تم الفحص)

---

### [CVE-COMPANIES-010] Race في `TierLimitsService.assertCanAddUser`
- **الخطورة:** LOW (موثقة سابقاً)
- **الموقع:** `tier-limits.service.ts:63-90`
- **السيناريو:**
  1. الشركة على BASIC (limit=10 users)، عندها 9 users
  2. Admin يبعت 2 invites في نفس الـ ms
  3. كلاهما يـ count → 9 (تحت الـ limit)
  4. كلاهما ينجح → الشركة بقت عندها 11 users (تجاوز الحد بـ 1)
- **التأثير:** Plan abuse — minor. الـ admin يقدر يـ over-provision بـ 1-2 users خلال الـ window. لا revenue loss فادح.
- **الإصلاح المقترح:** **NEEDS-CODER ⚠️** — `SELECT FOR UPDATE` على الـ company row قبل الـ count، أو DB-side count + conditional insert.
- **الحالة:** NEEDS-CODER ⚠️ — مؤجل (low impact، high traffic threshold)

---

## ملخص الإصلاحات

| الخطورة | لقى | اتصلح فوراً (FIXED-BY-HACKER) | يحتاج Coder (NEEDS-CODER) | مقبول/موثق |
|---|---|---|---|---|
| CRITICAL | 0 | 0 | 0 | 0 |
| HIGH | 0 | 0 | 0 | 0 |
| MEDIUM | 1 | 0 | 1 (CVE-USERS-001) | 0 |
| LOW | 5 | 2 (USERS-004, USERS-005) | 3 (AUTH-006, AUTH-007, COMPANIES-010) | 0 |
| INFO | 2 | 0 | 0 | 2 (USERS-008, USERS-009) |
| **المجموع** | **8** | **2** | **4** | **2** |

---

## ثغرات لسه مفتوحة (مع مبرر)

### NEEDS-CODER (مؤجلات للـ sessions القادمة)
- **CVE-USERS-001** — Last-SUPER_ADMIN race → يحتاج migration (DB check constraint) — session منفصل
- **CVE-AUTH-006** — Logout بـ JWT required → 1-line change (`@Public()`) لكن خارج النطاق الأصلي
- **CVE-AUTH-007** — Supabase orphan rollback → يحتاج outbox + worker (Phase 1 P0 المتبقي)
- **CVE-COMPANIES-010** — TierLimits race → low impact، يحتاج locking strategy

### ACCEPTED (مقبولة مع mitigation)
- **CVE-AUTH-002** — Lockout-as-DoS → الـ throttler 5/min يكفي للـ Phase 1
- **CVE-USERS-008** — `updateMyProfile` بدون companyId في الـ where → الـ userId global unique + JWT verified
- **CVE-USERS-009** — `activate` بدون SUPER_ADMIN check → ليست ثغرة فعلاً

---

## توصيات للمختبر

اعمل tests للحالات دي:

### Auth module
1. `registerCompany` يـ throw `BusinessException(AUTH_BIZ_002)` على duplicate email — assert على الـ `code` field مش الـ message
2. `registerCompany` ينجح → الـ audit_logs يحتوي على 2 rows (Company.CREATE + User.CREATE) بنفس الـ correlation_id
3. `login` بـ 5 محاولات فاشلة → الـ 6 attempt بـ `AUTH_BIZ_001` + `Retry-After` header
4. `login` بنجاح → `lastLogin` بيتحدّث **مرة واحدة** (مش على كل request — اختبر بـ multiple authenticated requests + check column ما اتغيرتش)
5. `login` بـ email موجود + password غلط vs email غير موجود → نفس الـ `userMessage` + نفس الـ `code` (constant-time-ish)
6. `refresh` بـ expired refresh token → `BusinessException(AUTH_BIZ_005)`
7. `JwtStrategy.validate` لا يكتب على الـ DB (mock الـ prisma.user.update + assert mock.called = false)

### Users module
8. `create` بدون password في الـ DTO → الـ response يحتوي `tempPassword` + `mustSharePasswordSecurely`
9. `create` بـ password في الـ DTO → الـ response **ما يحتويش** `tempPassword`
10. `create` فيه DB tx fail → Supabase rollback يحصل (mock + assert)
11. `updateMyProfile` يحدّث `specialty` فقط → الـ audit row الـ oldValues يحتوي `{ specialty: ... }` فقط (مش name/phone)
12. `update` (admin) يحدّث `avatar` فقط → الـ audit row الـ oldValues يحتوي `{ avatar: ... }` فقط (التحقق من CVE-USERS-004 fix)
13. `deactivate` على user عنده supabaseAuthId → الـ Supabase ban API بيتنادى بـ `ban_duration: '24h'`
14. `activate` → الـ Supabase API بيتنادى بـ `ban_duration: 'none'`
15. `deactivate` لما الـ Supabase API يرمي → الـ DB لسه updated (best-effort)
16. `changeRole` على SUPER_ADMIN واحد فقط → `ForbiddenException`
17. `softDelete` بدون reason / reason < 20 char → `BadRequestException`
18. `findAll` بـ `sortBy=supabaseAuthId` → 400 من الـ validation
19. `findAll` بـ `sortBy=name&sortOrder=asc` → ينجح
20. `updatePermissions` بـ permission بصيغة غلط (`db_drop` بدل `db.drop`) → `BadRequestException`
21. `generateSecurePassword` — distribution test: 10,000 samples → كل char في الـ alphabet له probability ~1/62 (لا bias)

### Companies module
22. `updateCompany` بدون role SUPER_ADMIN → `ForbiddenException` (403)
23. `updateCompany` بـ body فيها `subscriptionPlan: 'PRO'` → الـ ValidationPipe بـ `forbidNonWhitelisted: true` يرمي 400
24. `updateCompany` يحدّث `name` فقط → الـ audit row الـ oldValues يحتوي `{ name: ... }` فقط
25. `getStorageUsage` على شركة `storageQuota = 0` → `percentage = 0`، لا divide-by-zero
26. `getStorageUsage` على شركة `subscriptionPlan='ENTERPRISE'` → `tierLimits.maxUsers = Number.MAX_SAFE_INTEGER.toString()` يـ serialize صح

### Tenant isolation
27. SUPER_ADMIN من شركة A يحاول `findOne({ id: userFromCompanyB.id })` → `NotFoundException`
28. SUPER_ADMIN من شركة A يحاول `update` user من شركة B → `NotFoundException`
29. CLIENT من شركة A يحاول `GET /companies/me` → يرجع شركة A فقط (الـ `companyId` بييجي من الـ JWT، مش من الـ URL)
