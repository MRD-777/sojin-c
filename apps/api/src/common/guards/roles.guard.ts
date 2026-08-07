// ============================================
// Roles Guard
// Checks if user has required role
// Use with @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
//
// ⚠️ الأسماء **UPPERCASE** حصراً — كما في `enum UserRole` (schema.prisma).
// (التعليق كان مكتوباً lowercase وهي قيم غير موجودة في الـ enum إطلاقاً؛
//  اتصحّح ضمن S7-ROLES-GATE. قبل تقييد `@Roles` بـ `UserRole` كان أي واحد
//  ينقل التعليق حرفياً يحصل على endpoint مقفول على الجميع بصمت.)
// ============================================
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';
import { RequestWithUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip if @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Get required roles from decorator.
    // الـ generic هنا `UserRole[]` لا `string[]` — بكده المقارنة تحت
    // (`user.role === role`) بقت بين نوعين مُقيَّدين بنفس الـ enum على
    // الطرفين: الدور القادم من الـ JWT (`JwtPayload.role`) والدور المُعلَن
    // في الـ metadata. ده الشق التاني من إغلاق API-ROLES-001 + A3.
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('غير مصرح لك بالدخول');
    }

    // Super Admin has access to everything
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    if (!hasRole) {
      throw new ForbiddenException(
        'ليس لديك الصلاحية المطلوبة لتنفيذ هذا الإجراء',
      );
    }

    return true;
  }
}
