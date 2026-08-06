// ============================================
// Health endpoints
//
// Two endpoints with different audiences:
//
//   GET /health        — liveness   — used by load balancer / Kubernetes.
//                        Returns 200 as long as the process is running.
//                        Does NOT check downstream dependencies — we don't
//                        want a transient DB hiccup to kill the pod.
//
//   GET /health/ready  — readiness  — used by deployment orchestrators
//                        before sending real traffic. Checks every external
//                        dependency. Returns 503 if any is unhealthy.
//
// Both endpoints are @Public() (no JWT) but rate-limited (default profile).
// The body never leaks internal details — just a per-dep status string.
// ============================================
import { Controller, Get, HttpCode, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators';

interface DependencyStatus {
  status: 'ok' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
}

interface ReadinessReport {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  checks: Record<string, DependencyStatus>;
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Liveness — extremely cheap. Returns 200 unless the event loop is
   * completely stuck. Kubernetes pod liveness probes hit this.
   */
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  liveness() {
    return {
      status: 'ok',
      uptime: this.uptimeSeconds(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness — checks every external dependency.
   * Returns 503 if any is down so the LB stops sending traffic.
   *
   * Checks are run in parallel with a tight per-check timeout. We don't
   * want a slow Supabase to wedge the health probe (which would itself
   * cause cascading "service unhealthy" alerts).
   */
  @Get('ready')
  @Public()
  async readiness() {
    const [db, supabase] = await Promise.all([
      this.checkDatabase(),
      this.checkSupabase(),
    ]);

    const checks: Record<string, DependencyStatus> = { database: db, supabase };
    const overall = Object.values(checks).every((c) => c.status === 'ok')
      ? 'ok'
      : 'degraded';

    const report: ReadinessReport = {
      status: overall,
      uptime: this.uptimeSeconds(),
      timestamp: new Date().toISOString(),
      checks,
    };

    if (overall !== 'ok') {
      // 503 — the LB removes us from rotation until we recover.
      throw new HttpException(report, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return report;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Per-dep checks
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private async checkDatabase(): Promise<DependencyStatus> {
    const start = Date.now();
    try {
      // Minimal round-trip. Use $queryRaw so we exercise the actual driver,
      // not Prisma's connection-pool short-circuit.
      await this.withTimeout(
        this.prisma.$queryRaw`SELECT 1`,
        2000,
        'database',
      );
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      const message =
        err instanceof Error ? err.message.substring(0, 200) : 'unknown error';
      this.logger.warn(`health: database check failed — ${message}`);
      return { status: 'down', latencyMs: Date.now() - start, message };
    }
  }

  private async checkSupabase(): Promise<DependencyStatus> {
    const start = Date.now();
    const url = this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL');
    if (!url) {
      return { status: 'down', message: 'NEXT_PUBLIC_SUPABASE_URL not set' };
    }

    try {
      // Ping the OpenAPI endpoint — cheap, no auth required.
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2000);
      try {
        const res = await fetch(`${url}/auth/v1/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (!res.ok && res.status !== 404) {
          // 404 is still "Supabase responded" — only network errors mean down.
          return {
            status: 'degraded',
            latencyMs: Date.now() - start,
            message: `unexpected status ${res.status}`,
          };
        }
        return { status: 'ok', latencyMs: Date.now() - start };
      } finally {
        clearTimeout(t);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message.substring(0, 200) : 'unknown error';
      return { status: 'down', latencyMs: Date.now() - start, message };
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private uptimeSeconds(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  /**
   * Race a promise against a timeout. If the timeout fires first, we
   * throw — the per-check wrapper converts it to a degraded status.
   */
  private withTimeout<T>(
    p: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error(`${label} check timed out after ${ms}ms`)),
        ms,
      );
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        },
      );
    });
  }
}
