// ============================================
// AuditLogService mock utility — Session 1.5 MVT infrastructure
//
// Surface mirrors `AuditLogService` exactly so consumers can cast:
//   const auditLog = createMockAuditLog();
//   new SomeService(..., auditLog as unknown as AuditLogService, ...)
//
// Assertion patterns in callers:
//   expect(auditLog.logInTransaction).toHaveBeenCalledWith(
//     expect.any(Object),                          // tx
//     expect.objectContaining({                    // entry
//       entityType: 'user',
//       action: 'CREATE',
//       oldValues: null,
//     }),
//   );
//
// Both jest.fn()s default to resolving with `undefined` — the production
// service returns void, so callers don't depend on a return value.
// ============================================

export interface MockAuditLog {
  logInTransaction: jest.Mock;
  log: jest.Mock;
}

export function createMockAuditLog(): MockAuditLog {
  return {
    logInTransaction: jest.fn().mockResolvedValue(undefined),
    log: jest.fn().mockResolvedValue(undefined),
  };
}
