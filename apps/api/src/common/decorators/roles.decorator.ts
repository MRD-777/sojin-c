// ============================================
// @Roles() Decorator
// Mark endpoints with required roles
//
// 🔒 مُقيَّد بـ `UserRole` عن قصد (API-ROLES-001 / S7-ROLES-GATE البوابة ب):
// الـ signature كان `string[]`، فأي typo في اسم دور كان يعدّي الـ tsc وكل
// الـ specs **بصمت** — والنتيجة ذات اتجاهين: `@Roles('ACCOUNTENT')` بيقفل
// الـ endpoint على الدور المقصود (403 غامض يُقرأ كـ bug في الـ business
// logic)، وحذف/إعادة تسمية عضو في `enum UserRole` بيسيب كل الـ `@Roles`
// القديمة تـ compile نظيف وهي بتشير لدور مش موجود.
//
// بعد التقييد: أي اسم دور غلط = **خطأ وقت ترجمة** في مكانه بالظبط.
// ❌ ممنوع الرجوع لـ `string[]` أو تمرير `as UserRole` للالتفاف على خطأ —
// الخطأ ده معناه إن الاسم مش في الـ schema، والحل تصحيح الاسم لا إسكاته.
// ============================================
import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
