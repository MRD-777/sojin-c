# Scope

## المهمة
مراجعة شاملة لمديولات **Auth + Users + Companies** ضد الـ skills، واستخراج الـ findings وإصلاحها على دفعات.

## الملفات المتأثرة

### Auth module
- `apps/api/src/modules/auth/auth.service.ts` — registerCompany, login, refresh, logout
- `apps/api/src/modules/auth/auth.controller.ts` — endpoints + cookie strategy
- `apps/api/src/modules/auth/jwt.strategy.ts` — JWT validation + lastLogin write-on-every-request
- `apps/api/src/modules/auth/login-attempts.tracker.ts` — in-memory lockout
- `apps/api/src/modules/auth/dto/index.ts` — RegisterCompanyDto, LoginDto

### Users module
- `apps/api/src/modules/users/users.service.ts` — كل CRUD + role/permissions/deactivate/soft-delete
- `apps/api/src/modules/users/users.controller.ts` — RBAC decorators
- `apps/api/src/modules/users/dto/index.ts` — CreateUserDto, UpdateUserDto, ChangeRoleDto, UpdatePermissionsDto, ListUsersQueryDto

### Companies module
- `apps/api/src/modules/companies/companies.service.ts` — updateCompany, updateSettings, getStorageUsage
- `apps/api/src/modules/companies/companies.controller.ts` — endpoints
- `apps/api/src/modules/companies/tier-limits.service.ts` — assertCanAddUser/Project/UseStorage
- `apps/api/src/modules/companies/dto/update-company.dto.ts` — whitelist enforcement

### Shared (cross-module)
- `apps/api/src/common/dto/pagination.dto.ts` — sortBy whitelist (مشكلة مشتركة)

## الـ Skills المستخدمة
- `01-api-endpoints` — RBAC layers (Auth → Role → Ownership → Validation)
- `02-database` — transactions، soft-delete، indexes
- `03-auth-security` — password policies، session management، lockout
- `06-error-handling` — AppException hierarchy، error codes
- `07-audit-compliance` — كل mutation = audit، append-only
- `08-testing` — coverage على الـ services

## الحدود (خارج نطاق هذا الـ session)

### مؤجل لـ sessions قادمة بقصد
- **Redis-backed login attempts tracker** — التحويل من in-memory لـ Redis (نفس قرار IdempotencyService — يتعمل دفعة واحدة)
- **Frontend auth integration** — قرار Supabase-direct vs Backend-API لسه معلّق (D1)
- **Logout endpoint behind JwtAuthGuard** — السلوك الحالي مقبول: client بيحذف الـ cookie من جانبه؛ الـ best-effort signOut على الـ Supabase ميمنعش الـ logout
- **Forgot/Reset password flow** — Phase 2 feature
- **OAuth providers (Google/Microsoft)** — Phase 2

### خارج النطاق نهائياً
- أي تغيير في الـ Prisma schema — هذا session للـ business logic فقط
- ربط الفرونت بالـ NestJS API (auth flow unification) — تابع F3 في PLAN.md
- إعادة هيكلة الـ permissions catalog (نظام صلاحيات شامل) — feature منفصلة
