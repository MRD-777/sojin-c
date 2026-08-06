// ============================================
// @CurrentUser() Decorator
// Extracts the authenticated user from the request
// ============================================
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string; // Supabase auth ID
  email: string;
  userId: string; // Our internal user ID
  companyId: string;
  role: UserRole;
  permissions: string[];
}

export interface RequestWithUser extends Request {
  user?: JwtPayload;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (data) {
      return user?.[data];
    }
    return user;
  },
);
