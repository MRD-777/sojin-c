// ============================================
// Tenant Isolation Middleware
//
// Runs AFTER JwtAuthGuard (because routes apply guards before middleware
// completes for the controller, but middleware runs first for the request).
// At middleware time, `req.user` is not yet populated — that's the guard's job.
// So we DO NOT check user.companyId here.
//
// What this middleware does:
//   - For requests that DO have an attached user (via prior auth processing
//     in upstream proxies or admin paths), copies companyId onto the request
//     for cheap access by downstream code.
//
// Why we keep it lightweight:
//   - Heavy checks at middleware time slow every request (incl. health).
//   - The real multi-tenant enforcement lives in:
//       1. JwtStrategy.validate — loads companyId into payload
//       2. Services — explicit `where: { companyId: user.companyId }` filters
//
// This middleware is a convenience + a hook point for future tenant context
// (e.g., setting a Postgres session variable for RLS policies).
// ============================================
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { RequestWithUser } from '../decorators/current-user.decorator';

export interface RequestWithTenant extends RequestWithUser {
  companyId?: string;
}

@Injectable()
export class TenantIsolationMiddleware implements NestMiddleware {
  use(req: RequestWithTenant, _res: Response, next: NextFunction) {
    // Note: at middleware time, JwtAuthGuard hasn't run yet for the current
    // request, so `req.user` is typically undefined here. That's fine —
    // this is a no-op for unauthenticated requests, and a cheap copy when
    // a user IS attached (e.g., via a separate auth path).
    if (req.user?.companyId) {
      req.companyId = req.user.companyId;
    }
    next();
  }
}
