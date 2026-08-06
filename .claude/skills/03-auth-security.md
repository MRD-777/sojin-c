---
name: auth-security
description: Use when implementing authentication, authorization, session management, password handling, rate limiting, security headers, or any code touching user identity or access control. Enforces JWT lifecycle, ownership checks, sanitization, and OWASP top 10 protections.
---

# Auth & Security — Safety Rules

> ⚠️ Auth bug واحد = شركة كاملة بياناتها متسربة، فلوسها متحرّكة، عقودها مزوّرة.
> القاعدة: **افترض أن الـ JWT ممكن يكون مزوّر، الـ headers ممكن تكون malicious، والـ user ممكن يكون attacker — حتى تثبت العكس**.

---

## 1. JWT Lifecycle

### Access Token (قصير)
- **مدة**: 15 دقيقة بحد أقصى
- **مكان التخزين**: في الـ memory للـ frontend (Zustand state) أو closure variable
- **في الـ headers**: `Authorization: Bearer <token>`
- **ممنوع تماماً**: localStorage / sessionStorage / non-httpOnly cookies

### Refresh Token (طويل)
- **مدة**: 7-14 يوم
- **مكان التخزين**: **httpOnly cookie فقط** — `Secure` + `SameSite=Strict`
- **عند الاستخدام**: rotate كل مرة (issue refresh token جديد، invalidate القديم)
- **عند logout**: invalidate في الـ DB/Redis blacklist

✅ صح — Setup الـ refresh token cookie في `auth.controller.ts`:
```typescript
@Post('refresh')
@Public()
async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const refreshToken = req.cookies?.['refresh_token'];
  if (!refreshToken) throw new UnauthorizedException('انتهت الجلسة');

  const result = await this.authService.refreshToken({ refreshToken });

  // ✅ httpOnly + Secure + SameSite
  res.cookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    path: '/auth',  // الـ cookie بتتبعت فقط على /auth/* endpoints
  });

  return {
    accessToken: result.accessToken,
    expiresAt: result.expiresAt,
  };
}
```

❌ غلط — كارثة XSS:
```typescript
// Frontend
localStorage.setItem('refresh_token', refreshToken);  // ⛔ أي XSS = الـ token مسروق
```

### Supabase JWT Specifics
المشروع بيستخدم Supabase JWT (مش JWT custom). الـ `JWT_SECRET` env variable هو Supabase project's JWT secret.

- `payload.sub` = Supabase auth user ID (= `users.supabase_auth_id`)
- **مش `payload.userId`** — userId في الـ DB مختلف عن الـ supabase ID
- الـ JwtStrategy بيعمل lookup كل request — مكلف. شوف caching للـ user data في Redis مستقبلاً.

---

## 2. Three Layers of Authorization على كل endpoint

```
┌─────────────────────────────────────────┐
│  Layer 1: Authentication                │  → JwtAuthGuard (global)
│  هل JWT صحيح؟ user موجود؟ نشط؟         │
├─────────────────────────────────────────┤
│  Layer 2: Role-based Authorization      │  → @Roles() + RolesGuard
│  هل دور المستخدم مسموح بالـ endpoint؟ │
├─────────────────────────────────────────┤
│  Layer 3: Ownership / Resource Auth     │  → جوّا الـ service
│  هل المستخدم يملك/معيّن على المورد ده؟  │
└─────────────────────────────────────────┘
```

**كل endpoint لازم يعبر بالثلاث طبقات.** لو نقصت طبقة، اعتبره bug critical.

✅ صح:
```typescript
// Controller — Layer 1 + 2
@Get(':id')
@Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'CLIENT')
findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
  return this.updatesService.findOne(user, id);
}

// Service — Layer 3
async findOne(user: JwtPayload, updateId: string) {
  const update = await this.prisma.update.findFirst({
    where: { id: updateId, phase: { project: { companyId: user.companyId } } },
    include: { phase: { include: { project: true } } },
  });
  if (!update) throw new NotFoundException('التحديث غير موجود');

  // Ownership rules
  if (user.role === 'CLIENT') {
    if (update.phase.project.clientId !== user.userId) {
      throw new NotFoundException('التحديث غير موجود');  // مش Forbidden — ما نكشفش وجوده
    }
    if (update.status !== 'APPROVED') {
      throw new ForbiddenException('غير متاح للعرض');
    }
  } else if (!['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)) {
    // Engineer/Supervisor/Worker — لازم يكون معيّن على المشروع
    const assignment = await this.prisma.projectAssignment.findFirst({
      where: { projectId: update.phase.projectId, userId: user.userId, removedAt: null },
    });
    if (!assignment) {
      throw new NotFoundException('التحديث غير موجود');
    }
  }

  return update;
}
```

### Ownership Rules لكل دور

| Role | الصلاحية |
|---|---|
| `SUPER_ADMIN` | كل شيء في شركته |
| `PROJECT_MANAGER` | كل المشاريع في شركته |
| `SITE_ENGINEER` | المشاريع المعيّن عليها فقط |
| `SUPERVISOR` | المشاريع المعيّن عليها فقط |
| `ACCOUNTANT` | المشاريع المعيّن عليها فقط + read على كل المدفوعات (حسب الـ feature) |
| `WORKER` | تحديثاته الشخصية + المشاريع المعيّن عليها |
| `CLIENT` | مشاريعه فقط، APPROVED updates فقط، read-only |

**Cross-tenant check دايماً قبل ownership check.** لو الـ resource من شركة تانية → `NotFoundException` (مش Forbidden).

---

## 3. Rate Limiting

استخدم `@nestjs/throttler` (محتاج تثبيت):
```bash
pnpm add @nestjs/throttler
```

في `app.module.ts`:
```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },     // 100/دقيقة عام
      { name: 'auth', ttl: 60_000, limit: 5 },          // 5/دقيقة للـ auth
      { name: 'heavy', ttl: 60_000, limit: 10 },        // 10/دقيقة للـ exports
    ]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },   // global
    // ...
  ],
})
```

على الـ endpoints الحساسة:
```typescript
import { Throttle } from '@nestjs/throttler';

@Post('login')
@Public()
@Throttle({ auth: { limit: 5, ttl: 60_000 } })
login(@Body() dto: LoginDto) { /* ... */ }

@Post('register-company')
@Public()
@Throttle({ auth: { limit: 3, ttl: 60_000 } })
register(@Body() dto: RegisterCompanyDto) { /* ... */ }
```

**على مستوى الـ IP + User-Agent** (مش بس IP — corporate NATs خلف IP واحد).

---

## 4. Password Handling

المشروع بيستخدم Supabase لـ auth، يعني الـ passwords متخزّنة عند Supabase (Argon2). **مش لازم نخزن passwords بأنفسنا**. لكن:

- لو لأي سبب احتجت hashing داخلي (API keys, internal secrets): استخدم **bcrypt مع 12 rounds كحد أدنى**، أو **Argon2id** (الأفضل).

✅ صح:
```typescript
import * as bcrypt from 'bcrypt';

const hashedKey = await bcrypt.hash(apiKey, 12);
const valid = await bcrypt.compare(providedKey, storedHash);
```

❌ غلط:
```typescript
const hashed = md5(password);              // ⛔ MD5 مكسور
const hashed = sha256(password);           // ⛔ بدون salt
const hashed = await bcrypt.hash(pwd, 8);  // ⛔ rounds قليلة جداً
```

**Password requirements (في DTO):**
```typescript
@Matches(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
  { message: 'كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص' },
)
@MinLength(10)
@MaxLength(128)
adminPassword: string;
```

**ممنوع تماماً**:
- Log الـ password (حتى بعد hashing)
- إرجاع الـ password hash في أي API response
- مقارنة الـ passwords بـ `===` (timing attack)

---

## 5. ممنوع تخزين Sensitive Data في Logs

**ممنوع log:**
- Passwords (حتى الـ hashes)
- JWT tokens (access أو refresh)
- API keys / secrets
- بيانات البطاقات البنكية كاملة (PCI-DSS)
- محتوى chat messages الخاصة
- Personal Identifiable Information (PII) كاملة بدون masking

**استخدم Sanitization helper:**
```typescript
// common/utils/sanitize-log.ts
const SENSITIVE_KEYS = ['password', 'token', 'refreshToken', 'accessToken', 'secret', 'apiKey', 'creditCard'];

export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      out[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      out[key] = sanitizeForLog(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// استخدام:
this.logger.log(`User update: ${JSON.stringify(sanitizeForLog(dto))}`);
```

---

## 6. HTTPS إجباري — مفيش fallback

### في الـ API
```typescript
// main.ts
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}
```

### في الـ Frontend
- `next.config.js`: `redirects` من HTTP لـ HTTPS
- All `fetch` calls لـ `https://` URLs
- Cookies بـ `secure: true` في production

---

## 7. Security Headers (Helmet)

تثبيت:
```bash
pnpm add helmet
```

في `main.ts`:
```typescript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://*.supabase.co'],
        connectSrc: ["'self'", 'https://*.supabase.co'],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    crossOriginEmbedderPolicy: false,
  }),
);
```

### في Next.js
في `next.config.ts`:
```typescript
export default {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};
```

---

## 8. CORS — Strict whitelist

✅ صح:
```typescript
// main.ts
app.enableCors({
  origin: (origin, callback) => {
    const allowed = [
      'https://app.tampalets.com',
      'https://staging.tampalets.com',
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
    ];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,           // ضروري لو بنبعت cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  maxAge: 3600,
});
```

❌ غلط — كارثة:
```typescript
app.enableCors({ origin: '*', credentials: true });  // ⛔ مستحيل تشتغل + كارثة لو اشتغلت
app.enableCors();  // ⛔ default = allow all
```

---

## 9. CSRF Protection

لو بنستخدم cookies للـ refresh token، لازم CSRF protection.

**الحل البسيط:** Double Submit Cookie pattern مع `SameSite=Strict`. الـ `SameSite=Strict` يحمي من CSRF تلقائياً لمعظم الحالات.

**للـ state-changing endpoints (POST/PATCH/DELETE):**
- Check `Origin` و `Referer` headers
- اطلب custom header (`X-Requested-With: XMLHttpRequest`) — بسيط ويعمل

---

## 10. XSS Protection

### في الـ Backend
- **لا تثق بأي input** — حتى من users موثوقين
- لـ HTML rich content (chat messages, descriptions): استخدم `sanitize-html` على الـ server قبل التخزين

```typescript
import sanitizeHtml from 'sanitize-html';

const clean = sanitizeHtml(dto.description, {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  allowedAttributes: { a: ['href', 'target'] },
  allowedSchemes: ['http', 'https', 'mailto'],
});
```

### في الـ Frontend (Next.js + React)
- React بـ escape الـ values تلقائياً — `{userInput}` آمن
- **خطر**: `dangerouslySetInnerHTML` — استخدامه ممنوع إلا بعد sanitization
- خطر آخر: `href={userUrl}` — تأكد أن الـ URL مش `javascript:...`

---

## 11. Input Sanitization

كل input من user (search query, filename, etc.) لازم يتسانتايز قبل أي معالجة:

✅ صح:
```typescript
// Search query — strip special chars
const safeSearch = dto.search?.replace(/[<>;'"\\]/g, '').trim().substring(0, 100);

// Filename — UUID + extension validation فقط
const ext = path.extname(originalName).toLowerCase();
if (!['.jpg', '.png', '.pdf'].includes(ext)) throw new BadRequestException('نوع الملف غير مدعوم');
const safeName = `${randomUUID()}${ext}`;
```

---

## 12. Account Lockout & Brute Force

- بعد **5 محاولات فاشلة في الدقيقة**: lock للـ account لمدة 15 دقيقة
- بعد **20 محاولة فاشلة في اليوم**: lock + إرسال email للمستخدم
- log كل محاولة فاشلة مع IP + timestamp + email

```typescript
// auth.service.ts
async login(dto: LoginDto) {
  const attemptsKey = `login_attempts:${dto.email.toLowerCase()}`;
  const attempts = await this.redis.incr(attemptsKey);
  if (attempts === 1) await this.redis.expire(attemptsKey, 900);  // 15 min TTL

  if (attempts > 5) {
    this.logger.warn(`Account locked: ${dto.email} (attempts: ${attempts})`);
    throw new UnauthorizedException('تم قفل الحساب مؤقتاً — حاول بعد 15 دقيقة');
  }

  const { data, error } = await this.supabase.auth.signInWithPassword({ /* ... */ });

  if (error) {
    this.logger.warn(`Failed login: ${dto.email} from ${req.ip}`);
    throw new UnauthorizedException('البريد أو كلمة المرور غير صحيحة');
  }

  await this.redis.del(attemptsKey);  // reset on success
  return data;
}
```

---

## 13. Session Management

- على logout: invalidate الـ refresh token (DB blacklist أو Redis)
- على password change: invalidate **كل** الـ sessions للمستخدم
- على role change من admin: invalidate الـ user's sessions (force re-login)
- session timeout: 30 دقيقة inactivity

---

## 14. Audit Critical Auth Events

سجّل دايماً في `audit_logs`:
- Login (success/fail)
- Logout
- Password change
- Email change
- Role change (من admin)
- Permission grant/revoke
- Account lockout
- Token refresh من IP جديد

---

## Anti-patterns (ممنوعات)

```typescript
// ⛔ 1. Storing tokens in localStorage
localStorage.setItem('access_token', token);

// ⛔ 2. Endpoint without @Roles
@Post('payments') create() {}

// ⛔ 3. Service without ownership check
return prisma.payment.findUnique({ where: { id } });

// ⛔ 4. Hashing without proper algorithm
const hash = crypto.createHash('md5').update(pwd).digest('hex');

// ⛔ 5. Logging sensitive data
logger.log(`Login: ${email} / ${password}`);

// ⛔ 6. CORS open
app.enableCors({ origin: '*' });

// ⛔ 7. Cookies without httpOnly + Secure
res.cookie('token', value);  // missing httpOnly, secure, sameSite

// ⛔ 8. Trusting client-side role checks
if (user.role === 'ADMIN') { /* do admin stuff */ }  // frontend only

// ⛔ 9. SQL injection via raw query
prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`);

// ⛔ 10. Returning password hash in response
return { user: { id, email, password: user.password } };
```

---

## Threat Model — اسأل نفسك

قبل أي endpoint/feature:
1. **Spoofing**: هل يمكن لأحد ينتحل شخصية مستخدم آخر؟
2. **Tampering**: هل يمكن تعديل الـ request في الطريق؟ (HTTPS + signature)
3. **Repudiation**: لو حصل dispute، عندنا audit log كافي؟
4. **Information Disclosure**: هل الـ response بترجع بيانات أكتر من اللازم؟
5. **Denial of Service**: rate limit موجود؟
6. **Elevation of Privilege**: ممكن WORKER يعمل operation تخص ACCOUNTANT؟

---

## Checklist قبل أي PR فيه auth/security code

- [ ] الـ endpoint عليه `@Roles()` بشكل صريح
- [ ] Ownership check في الـ service (companyId + role-specific)
- [ ] Cross-tenant test: جربت بـ JWT من شركة تانية → NotFound
- [ ] لو فيه session: التوكنات في httpOnly cookies (مش localStorage)
- [ ] لو فيه password input: bcrypt 12+ أو Argon2id
- [ ] مفيش sensitive data في logs
- [ ] Rate limit مناسب
- [ ] Helmet/security headers مفعّلة
- [ ] CORS strict whitelist
- [ ] Audit log للـ auth events
- [ ] جربت brute force scenario
- [ ] جربت XSS payload في كل input field
- [ ] جربت SQL injection في search params
