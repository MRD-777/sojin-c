// ============================================
// Request-scoped context via AsyncLocalStorage.
//
// Why this exists:
//   - Logger needs the request ID without it being passed through every layer.
//   - Audit log entries need the requestId for correlation with the access log.
//   - Background jobs spawned from a request can still inherit the trace ID.
//
// Why AsyncLocalStorage (and not zone.js / cls-hooked):
//   - Built into Node ≥16, no extra dep, no monkey-patching.
//   - Honors async/await + promises natively.
//   - Survives the NestJS interceptor → guard → handler chain.
//
// Lifecycle:
//   1. CorrelationIdMiddleware reads/generates X-Request-Id
//   2. It runs the rest of the request inside `als.run({ requestId }, next)`
//   3. Anywhere in the request scope, RequestContext.requestId() returns it
// ============================================
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestScope {
  requestId: string;
  /** ISO timestamp of when the request entered the middleware. */
  startedAt: string;
}

const als = new AsyncLocalStorage<RequestScope>();

export const RequestContext = {
  /** Internal — used by the middleware. */
  run<T>(scope: RequestScope, fn: () => T): T {
    return als.run(scope, fn);
  },

  /** Get the current request ID. Returns undefined outside a request. */
  requestId(): string | undefined {
    return als.getStore()?.requestId;
  },

  /** Full scope or undefined. */
  current(): RequestScope | undefined {
    return als.getStore();
  },
};
