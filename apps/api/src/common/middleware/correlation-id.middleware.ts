// ============================================
// Correlation ID middleware
//
// For every request:
//   1. Read `X-Request-Id` if the client (or upstream LB) supplied one.
//      - Must match a safe format: 16–64 chars, [A-Za-z0-9-_]. Anything
//        else is replaced with a fresh UUID — we don't trust client-supplied
//        IDs blindly (could be log injection).
//   2. Otherwise mint a UUID v4.
//   3. Echo it back on the response as `X-Request-Id` so the client can
//      reference it in bug reports.
//   4. Run the rest of the request inside an AsyncLocalStorage scope so
//      any code can read the ID via RequestContext.requestId().
// ============================================
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../context/request-context';

const SAFE_ID = /^[A-Za-z0-9_-]{16,64}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const supplied = req.headers['x-request-id'];
    const safeSupplied =
      typeof supplied === 'string' && SAFE_ID.test(supplied) ? supplied : null;

    const requestId = safeSupplied ?? randomUUID();

    // Echo for the client + downstream services
    res.setHeader('X-Request-Id', requestId);

    // Attach to the request object too — non-Nest consumers (express bits)
    // can read it without pulling in AsyncLocalStorage.
    (req as Request & { requestId?: string }).requestId = requestId;

    RequestContext.run(
      { requestId, startedAt: new Date().toISOString() },
      () => next(),
    );
  }
}
