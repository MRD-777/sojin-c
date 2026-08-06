# تقرير المخطط 🧠 (ما بعد التنفيذ)

> Session: 2026-05-16-review-auth-users-companies
> الدور: 🧠 Architect — Post-execution review
> التاريخ: 2026-05-16

---

## مقارنة Plan vs Reality

| البند | المخطط | المنفّذ | متطابق؟ |
|---|---|---|---|
| **المرحلة 1: A1** registerCompany audit | Company.CREATE + User.CREATE داخل tx + req threading | ✅ بالظبط — 2 audit rows داخل `$transaction` | ✅ |
| **المرحلة 1: A5** updateMyProfile audit | tx wrap + oldValues snapshot على الحقول المتغيرة | ✅ — pre-fetch محدود، tx wrap، audit row UPDATE | ✅ |
| **المرحلة 2: A2** lastLogin removal | حذف الـ update block من JwtStrategy.validate | ✅ — استُبدِل بـ comment يشرح الـ rationale | ✅ |
| **المرحلة 3: A3** deactivate ban | ban_duration: 24h على deactivate، none على activate | ✅ — بعد الـ tx، best-effort، guard على null supabaseAuthId | ✅ |
| **المرحلة 4: A4** invite flow | الـ create يرجع tempPassword + warning | ⚠️ تحسين — تمييز admin-provided password (لا echo) من generated (echo once) | ⚠️ |
| **المرحلة 5: A6** sortBy whitelist | `@IsIn([...])` على ListUsersQueryDto.sortBy | ✅ — 5 columns مسموحة، `declare` لتجنب override warning | ✅ |
| **المرحلة 6: A8** AppException Auth | كل throws → BusinessException/SystemException + 9 codes جديدة | ✅ — 9 codes في error-codes.ts، 9 throws محوّلة | ✅ |
| **المرحلة 6: A9** SupabaseAdminProvider | shared client + DI token | ✅ — `@Global()` module، Symbol token، autoRefresh/persist off | ✅ |
| **A7 — permission catalog** | مؤجل (Q2 — يلمس packages/shared-types) | ⏸ لم يُنفَّذ بقصد | ✅ |
| Migration changes | 0 | 0 | ✅ |
| Breaking changes for consumers | فقط sortBy whitelist | فقط sortBy whitelist (لا frontend consumer حالياً) | ✅ |

---

## الانحرافات عن الـ Plan

### الانحراف الوحيد — مرحلة 4 (A4): Invite Flow

**ما الذي تغيّر:**
- الـ plan قال: "يرجّع tempPassword في الـ response دايماً"
- المبرمج نفّذ: "يرجّع tempPassword فقط لما الـ service يولّدها (admin مبعتش password). لو الـ admin بعت password، ميرجعهاش"

**التحليل المعماري:**

هذا انحراف **تحسيني**، ليس عدول عن النية. الـ goal الأصلي للـ Q1=A كان: "نضمن إن الـ admin يعرف الـ password عشان يبعتها للـ user manually". الـ goal محقق في كلا الحالتين:
- لو الـ admin بعت password → هو يعرفها (هو اللي اختارها).
- لو ما بعتش → الـ service يولّد ويرجّعها مرة واحدة.

**التأثير الإيجابي:** يقلل الـ attack surface — مفيش echo للـ admin-provided password على wire. لو الـ admin بعت password ضعيفة (مثلاً نسخها من Notion)، ما بنحطهاش في response body + HTTP logs بدون داعي.

**Trade-off:** الـ API response shape بقى conditional (`tempPassword` field optional). الـ frontend لازم يـ handle كلا الحالتين. Acceptable لأن الـ flow مش متبني في الـ frontend لسه.

**القرار:** **انحراف مقبول ومبرر** — أوافق على التغيير وأطلب توثيقه في الـ OpenAPI spec وقت ما يتعمل integration.

---

## تقييم المعمارية

### نقاط قوية في التنفيذ

1. **Transaction boundaries نظيفة** — كل mutation الآن: `update + audit` في `$transaction` واحدة. الفشل في الـ audit row → rollback الـ DB write. هذا exactly skill 07's "audit failure rolls back the mutation".

2. **Defense-in-depth في deactivate/activate** — الفصل بين الـ DB flag (`isActive`) والـ IdP ban (Supabase `ban_duration`):
   - DB flag = primary gate (JwtStrategy reject)
   - IdP ban = secondary gate (refresh-token mint prevention)
   - الـ best-effort failure handling (لو IdP fails ما يـ rollback) صح — الـ DB-side فقط كافي للـ API.

3. **Whitelisting consistency** — كل DTOs الـ 3 modules بقت بـ field-by-field whitelisting في الـ services. لا mass-assignment surface.

4. **AppException hierarchy موحّد** — error codes الـ Auth بقت stable IDs (AUTH_BIZ_*/AUTH_SYS_*). الفرونت/الـ tests يقدر يـ assert على الـ code بدلاً من string-matching الـ Arabic message.

5. **SupabaseAdminProvider centralization** — clean DI pattern؛ يسهّل الـ mocking في الـ tests + يجعل rotation للـ service-role key مكان واحد.

6. **Constant-time-ish login** — نفس الـ error message للـ "email غلط" و "password غلط". skill 03 §"user enumeration defense" مطبق.

### نقاط ضعف معمارية (لم تُعالَج هذه الـ session بقصد)

1. **LoginAttemptsTracker لسه in-memory** — `Map<string, AttemptRecord>`. لو الـ API على 2 instances، الـ lockout مش shared. عند الـ horizontal scale لازم يتحول لـ Redis. **مؤجل في الـ scope** — موثق في الـ "خارج النطاق".

2. **slug uniqueness على soft-deleted companies** — `reserveUniqueSlug` يستخدم `findUnique({ slug })` بدون `deletedAt: null` filter. شركة محذوفة softly تحتجز slug للأبد. **finding ثانوي موثق** — منخفض الخطورة.

3. **TierLimitsService race condition** — `count + create` غير atomic. ممكن workspace يتجاوز الـ limit بـ 1-2 users لو الـ admin عمل 3 invites متوازية. **مقبول** — الـ traffic منخفض ولا يستحق locking overhead. **يحتاج فيكس** عند الـ scale.

4. **A7 (permission catalog) لسه مفتوح** — `updatePermissions` يقبل أي string بصيغة `resource.action`. الـ admin يقدر يحفظ permissions غير موجودة في الـ catalog. **مؤجل بقرار** — يلمس `packages/shared-types`. يحتاج session منفصل.

### ملاحظات عابرة

- الـ `users.service.ts:135` cast إلى `Prisma.InputJsonValue` — حل tactical للـ type system. الـ DTO يستخدم `Record<string, unknown>` لكن الـ schema يستخدم `Json`. حل أفضل: تعريف Zod schema للـ `notificationPreferences` shape. **مؤجل** — مش blocker.
- 4 pre-existing typecheck errors في `payments` + `updates` modules (`@prisma/client/runtime/library` نُقل في Prisma 7). **خارج النطاق** لكن **مهم** — يحتاج session منفصل لتصحيح كل الـ Decimal imports.

---

## حاجات محتاجة تتعمل في sessions قادمة

| البند | الأولوية | الـ rationale |
|---|---|---|
| **A7 — permission catalog whitelist** | P1 | data integrity في الـ permissions field |
| **Redis-backed LoginAttemptsTracker** | P1 (قبل production) | lockout عبر instances |
| **Redis-backed IdempotencyService** | P1 (قبل production) | نفس السبب |
| **Fix `@prisma/client/runtime/library` imports** | P0 | الـ typecheck مكسور على payments/updates |
| **`reserveUniqueSlug` يفلتر deletedAt** | P3 | slug squatting (خطورة منخفضة) |
| **NotificationsModule wiring** | P0 | عشان invite flow يبقى عبر email بدلاً من echo password |
| **TierLimitsService locking** | P2 | عند الـ scale فقط |

---

## الحكم

✅ **التنفيذ متوافق مع الـ Plan**

ملاحظة واحدة: انحراف مقبول في المرحلة 4 (A4) — admin-provided password ما بترجعش في الـ response. تحسين معماري يقلل الـ attack surface بدون كسر النية الأصلية للـ Q1=A.

**الـ pre-existing errors في payments/updates** (`@prisma/client/runtime/library`) ليست من هذه الـ session لكن يجب فتح session منفصل لإصلاحها — الـ typecheck الكلي مكسور بسببها.

**الـ build جاهز** للمرحلة التالية: 🔴 الهاكر.
