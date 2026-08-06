// ============================================
// CorrelationIdMiddleware tests
// ============================================
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { RequestContext } from '../context/request-context';
import type { Request, Response } from 'express';

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function makeRes(): Response {
  const setHeader = jest.fn();
  return { setHeader } as unknown as Response;
}

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('mints a UUID when no X-Request-Id header is supplied', () => {
    const req = makeReq();
    const res = makeRes();
    let observed: string | undefined;

    middleware.use(req, res, () => {
      observed = RequestContext.requestId();
    });

    expect(observed).toBeDefined();
    expect(observed).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect((req as Request & { requestId?: string }).requestId).toBe(observed);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', observed);
  });

  it('reuses a SAFE supplied X-Request-Id', () => {
    const supplied = 'a'.repeat(32); // valid: 16-64 alphanumeric-ish
    const req = makeReq({ 'x-request-id': supplied });
    const res = makeRes();

    middleware.use(req, res, () => {
      expect(RequestContext.requestId()).toBe(supplied);
    });

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', supplied);
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'x'.repeat(100)],
    ['with newline', 'safe-but-\nbad'],
    ['with semicolon', 'log;injection'],
    ['empty string', ''],
  ])('replaces UNSAFE X-Request-Id (%s)', (_label, bad) => {
    const req = makeReq({ 'x-request-id': bad });
    const res = makeRes();
    let observed: string | undefined;

    middleware.use(req, res, () => {
      observed = RequestContext.requestId();
    });

    expect(observed).not.toBe(bad);
    expect(observed).toMatch(/^[0-9a-f-]{36}$/); // fresh UUID
  });

  it('isolates context between concurrent requests', async () => {
    // Two requests, two IDs, two different async tasks — neither sees
    // the other's ID even though they overlap in time.
    const captured: Record<string, string | undefined> = {};

    const handler = async (id: string) => {
      return new Promise<void>((resolve) => {
        const req = makeReq({ 'x-request-id': id });
        const res = makeRes();
        middleware.use(req, res, async () => {
          await new Promise((r) => setTimeout(r, 10));
          captured[id] = RequestContext.requestId();
          resolve();
        });
      });
    };

    await Promise.all([
      handler('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      handler('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
    ]);

    expect(captured['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']).toBe(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(captured['bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']).toBe(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
  });

  it('RequestContext.requestId() is undefined outside any request', () => {
    expect(RequestContext.requestId()).toBeUndefined();
  });
});
