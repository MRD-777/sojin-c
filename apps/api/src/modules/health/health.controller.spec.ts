// ============================================
// HealthController tests
// ============================================
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let queryRaw: jest.Mock;
  let configGet: jest.Mock;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    configGet = jest.fn().mockReturnValue('https://stub.supabase.co');

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  // ─── liveness ──────────────────────────────────────────

  describe('liveness', () => {
    it('returns ok without touching any dependency', () => {
      const result = controller.liveness();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  // ─── readiness ─────────────────────────────────────────

  describe('readiness', () => {
    it('returns ok when all dependencies respond', async () => {
      fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: true, status: 200 } as Response);

      const result = await controller.readiness();
      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.supabase.status).toBe('ok');
    });

    it('throws 503 when the database is down', async () => {
      queryRaw.mockRejectedValue(new Error('connection refused'));
      fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: true, status: 200 } as Response);

      await expect(controller.readiness()).rejects.toMatchObject({
        constructor: HttpException,
      });

      try {
        await controller.readiness();
      } catch (err) {
        if (err instanceof HttpException) {
          expect(err.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
          const body = err.getResponse() as {
            status: string;
            checks: Record<string, { status: string; message?: string }>;
          };
          expect(body.status).toBe('degraded');
          expect(body.checks.database.status).toBe('down');
          // Error message should be truncated and present
          expect(body.checks.database.message).toContain('connection refused');
        }
      }
    });

    it('marks Supabase as degraded (not down) on unexpected HTTP status', async () => {
      fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: false, status: 500 } as Response);

      try {
        await controller.readiness();
      } catch (err) {
        if (err instanceof HttpException) {
          const body = err.getResponse() as {
            checks: Record<string, { status: string }>;
          };
          expect(body.checks.supabase.status).toBe('degraded');
        }
      }
    });

    it('reports Supabase down when fetch throws (network failure)', async () => {
      fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        await controller.readiness();
      } catch (err) {
        if (err instanceof HttpException) {
          const body = err.getResponse() as {
            checks: Record<string, { status: string; message?: string }>;
          };
          expect(body.checks.supabase.status).toBe('down');
          expect(body.checks.supabase.message).toContain('ECONNREFUSED');
        }
      }
    });

    it('reports Supabase down when SUPABASE_URL is missing', async () => {
      configGet.mockReturnValue(undefined);

      try {
        await controller.readiness();
      } catch (err) {
        if (err instanceof HttpException) {
          const body = err.getResponse() as {
            checks: Record<string, { status: string; message?: string }>;
          };
          expect(body.checks.supabase.status).toBe('down');
          expect(body.checks.supabase.message).toContain('not set');
        }
      }
    });
  });
});
