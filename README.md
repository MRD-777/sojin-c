# 🏗️ Construction SaaS

منصّة SaaS لإدارة مشاريع المقاولات والإنشاءات — متعددة الشركات (multi-tenant)، بواجهة عربية/إنجليزية (RTL/LTR).

المشروع **monorepo** مبني على Turborepo، بيضم backend بـ NestJS و frontend بـ Next.js، وبيشتركوا في حزمة types واحدة.

> **الحالة:** قيد التطوير النشط. الـ backend مغطّى بـ 28 spec، والـ frontend في مرحلة ربط الصفحات بالـ API. تفاصيل محدّثة في [`BACKEND_STATUS.md`](BACKEND_STATUS.md) و [`FRONTEND_STATUS.md`](FRONTEND_STATUS.md).

---

## الـ Stack

| الطبقة | التقنية |
|---|---|
| **Backend** | NestJS 11 · TypeScript 5.7 · Prisma 7 · Passport/JWT |
| **Frontend** | Next.js 16 (Turbopack) · React 19 · Tailwind 4 · shadcn/ui |
| **قاعدة البيانات** | PostgreSQL (Supabase) عبر `@prisma/adapter-pg` |
| **المصادقة** | Supabase Auth — توقيع **ES256** يتحقق عبر JWKS |
| **الحالة (client)** | TanStack Query · Zustand · Zod |
| **الترجمة** | next-intl (عربي / إنجليزي) |
| **الطوابير والوسائط** | BullMQ · Sharp · Supabase Storage |
| **الاختبارات** | Jest (api) · Vitest + Testing Library (web) |
| **الـ Monorepo** | Turborepo · npm workspaces |

---

## هيكل المشروع

```
saas-one/
├── apps/
│   ├── api/                  # NestJS — REST API تحت /api/v1
│   │   ├── prisma/           # schema.prisma + migrations
│   │   ├── scripts/          # seed للديمو + smoke tests
│   │   └── src/
│   │       ├── common/       # guards · interceptors · filters · idempotency
│   │       ├── modules/      # 14 module (تفاصيلها تحت)
│   │       └── prisma/       # PrismaService
│   └── web/                  # Next.js — App Router بـ [locale]
│       └── src/app/[locale]/
│           ├── (auth)/       # login · register · setup-workspace
│           └── dashboard/    # projects · finance · team · audit · reports
├── packages/
│   └── shared-types/         # types مشتركة بين الـ api والـ web
├── .claude/                  # نظام أدوار كلود — skills · sessions · docs
└── .agents/skills/           # skills إضافية (Supabase / Postgres best practices)
```

---

## التشغيل

### المتطلبات

- **Node.js ≥ 20**
- **npm 10** (الـ workspaces متظبّطة عليه — الـ `packageManager` مثبّت في `package.json`)
- مشروع **Supabase** (أو أي PostgreSQL + بديل للـ Auth والـ Storage)

### 1. تثبيت الحزم

```bash
git clone https://github.com/MRD-777/sojin-c.git
cd sojin-c
npm install
```

### 2. متغيرات البيئة

انسخ ملفات المثال واملأ القيم الحقيقية:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

> ⚠️ ملفات `.env` **مستبعدة من الجيت** بالكامل. متحطّش فيها أي سرّ وترفعه.

أهم المتغيرات في `apps/api/.env`:

| المتغير | الوصف |
|---|---|
| `DATABASE_URL` | connection string من Supabase → Connect → **Session pooler (port 5432)** |
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح service-role (server-side فقط — **متعرّضهوش للمتصفح**) |
| `JWT_SECRET` | لتسجيل `JwtModule` والتحقق من البيئة فقط — **مش مستخدَم في التحقق من التوكن** |
| `COOKIE_SECRET` | توقيع كوكي الـ refresh token (httpOnly) |
| `PORT` | منفذ الـ API — الافتراضي `4000` |
| `CORS_ALLOWED_ORIGINS` | قائمة مفصولة بفواصل — مثلاً `http://localhost:3000` |
| `DOCS_ENABLED` | `true` يفعّل Swagger على `/docs` |

### 3. قاعدة البيانات

```bash
npm run db:generate     # توليد Prisma Client
npm run db:push         # مزامنة الـ schema مع قاعدة البيانات
npm run db:studio       # واجهة Prisma Studio (اختياري)
```

لبيانات ديمو:

```bash
node apps/api/scripts/create-demo-users.mjs
```

### 4. التشغيل

```bash
npm run dev             # الاتنين مع بعض عبر Turborepo
npm run dev:api         # الـ API فقط  → http://localhost:4000
npm run dev:web         # الـ web فقط  → http://localhost:3000
```

- الـ API base: `http://localhost:4000/api/v1`
- Swagger (لما `DOCS_ENABLED=true`): `http://localhost:4000/docs`
- الـ health check: `GET /health` و `GET /health/ready` — **بدون** الـ prefix، عشان probes الـ deployment تلاقيها على رابط ثابت مهما اتغيّر إصدار الـ API

---

## الأوامر

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | تشغيل كل الـ apps |
| `npm run build` | بناء كل الـ apps |
| `npm run lint` | فحص الكود |
| `npm run test` | تشغيل كل الاختبارات |
| `npm run db:generate` / `db:push` / `db:studio` | أوامر Prisma |

داخل `apps/api`: `npm run test:cov` للتغطية، و `npm run test:e2e` لاختبارات الـ end-to-end.

---

## الـ API

كل المسارات تحت `/api/v1`، ومحميّة بـ Helmet + rate limiting (`@nestjs/throttler`) + CORS allow-list.

| الـ Module | المسؤولية |
|---|---|
| `auth` | تسجيل الدخول والتسجيل، refresh tokens، حراس الأدوار |
| `users` | إدارة المستخدمين والدعوات |
| `companies` | الشركات (حدود الـ tenant) والاشتراكات |
| `projects` | المشاريع، التعيينات، الصلاحيات على مستوى المشروع |
| `phases` | مراحل المشروع وحالاتها |
| `updates` | التحديثات اليومية من الموقع + versioning + سير الموافقات |
| `media` | رفع الصور/الفيديو، معالجة بـ Sharp، فحص الأمان |
| `payments` | الدفعات والمستخلصات |
| `finance` | الإعدادات المالية، بنود الـ BOQ، ملخّصات الربحية |
| `comments` | التعليقات على التحديثات والمراحل |
| `chat` | غرف المحادثة والرسائل |
| `sub-contractors` | مقاولو الباطن وربطهم بالمراحل |
| `audit` | سجل التدقيق (append-only) |
| `health` | فحص الجاهزية |

**من `common/`:** idempotency store (يمنع الـ double-submit)، soft-delete filter، حراس الـ tenant isolation، وinterceptors للاستجابة الموحّدة.

---

## نموذج البيانات

22 model في [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma)، أهمها:

`Company` → `User` → `Project` → `Phase` → `Update` → `Media` / `Comment`
بجانب `Payment` · `BOQItem` · `SubContractor` · `ChatRoom` · `AuditLog` · `IdempotencyRecord`.

**الأدوار (`UserRole`):**

```
SUPER_ADMIN · PROJECT_MANAGER · SITE_ENGINEER · SUPERVISOR · ACCOUNTANT · WORKER · CLIENT
```

العزل بين الشركات (**tenant isolation**) مفروض على مستوى الـ query نفسه — مش بفلترة بعد الجلب.

---

## ⚠️ ملاحظة مهمة عن المصادقة

مشروع Supabase هنا بيوقّع توكنات الدخول بمفتاح **غير متماثل (ES256 / EC P-256)** — **مش HS256**.

نتيجةً لكده:

- `jwt.strategy.ts` بيتحقق من التوكن عبر **JWKS** على `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` باستخدام `jwks-rsa`.
- الخوارزمية مثبّتة على `['ES256']` مع التحقق من `issuer` و `audience` — دفاع ضد هجمات **alg-confusion**.
- `JWT_SECRET` بيخدم تسجيل `JwtModule` والتحقق من البيئة **فقط**. متحاولش تستخدمه للتحقق من التوكن — مش هيشتغل.

لو Supabase رجّع للتوقيع المتماثل مستقبلاً، لازم عكس التغيير ده صراحةً.

---

## الاختبارات

```bash
npm run test                              # كل شيء
npm --prefix apps/api run test            # 28 spec للـ backend
npm --prefix apps/api run test:cov        # مع تقرير التغطية
npm --prefix apps/web run test            # Vitest للـ frontend
```

الـ specs مكتوبة على قاعدة إن الاختبار لازم **يعضّ** لا يوصف: يتم تعطيل الإصلاح المستهدَف عمداً للتأكد إن الـ spec بيسقط فعلاً (mutation check). التفاصيل في [`CLAUDE.md`](CLAUDE.md) — القاعدتين ‎#5 و ‎#5b.

---

## نظام أدوار كلود (`.claude/`)

المشروع ده متطوّر بمنهجية أدوار منظّمة مع [Claude Code](https://claude.com/claude-code)، وكل سجلاتها مرفوعة مع الكود:

| المسار | المحتوى |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | تعريف النظام: 3 modes (Quick / Standard / Deep) و 10 قواعد ثابتة |
| `.claude/sessions/` | 17 session موثّقة — الخطة، تقرير المبرمج، تقرير الهاكر، تقرير المختبر، قرار المراجع |
| `.claude/sessions/BACKLOG.md` | البنود المؤجّلة عبر الـ sessions — **اقراه قبل بدء أي شغل جديد** |
| `.claude/docs/` | مراجع الـ backend، خطة التكامل، متتبّع ربط الصفحات |
| `.claude/skills/` و `.agents/skills/` | skills متخصصة (Supabase / Postgres best practices وغيرها) |

كل session بتمشي في سلسلة أدوار: 🧠 المخطط → 💻 المبرمج → 🔴 الهاكر → 🧪 المختبر → 👁️ المراجع، مع وقفة إلزامية بين كل دور. الفكرة إن التوثيق ده **جزء من الكود**، مش ملحق بيه — أي حد بيكمّل الشغل يقدر يعرف *ليه* الكود على الشكل ده، مش بس *إيه* اللي فيه.

> **ملاحظة:** `.claude/settings.local.json` مستبعد من الجيت عن قصد — بيسجّل أوامر shell محلية ممكن تحتوي على بيانات اعتماد.

---

## المساهمة

1. اعمل branch من `main`.
2. اتبع المنهجية في [`CLAUDE.md`](CLAUDE.md) لو بتشتغل بأدوار كلود.
3. أي إصلاح لازم يجيب معاه spec — الحد الأدنى spec واحد لكل fix.
4. متـ commit-ش أي ملف `.env` أو سرّ. راجع [`.gitignore`](.gitignore) قبل الرفع.

---

## الترخيص

خاص (UNLICENSED) — كل الحقوق محفوظة.
