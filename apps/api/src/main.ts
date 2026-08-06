// ============================================
// 🏗️ Construction SaaS — API Entry Point
//
// Bootstrap order matters here. Each step is annotated with why.
// ============================================
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { buildCorsOptions } from './common/config/cors.config';
import { buildHelmetOptions } from './common/config/security.config';
import { validateEnvironment } from './common/config/env-validation';

// .env files are loaded by NestJS's ConfigModule once the app boots — but
// validateEnvironment() runs BEFORE that. Pre-load them here so the check
// can see the values.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' });
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config(); // .env

async function bootstrap() {
  // Fail-fast on misconfigured env BEFORE Nest spends time wiring DI.
  validateEnvironment();

  const app = await NestFactory.create(AppModule, {
    // Disable Nest's default body logger in production — we'll add structured
    // logging via the correlation middleware. Keep the default in dev for DX.
    bufferLogs: process.env.NODE_ENV === 'production',
  });

  const logger = new Logger('Bootstrap');

  // ── trust proxy ─────────────────────────────────────────
  // We sit behind Supabase's edge (Vercel / Fly / etc.). Without this,
  // `req.ip` is always the proxy IP, breaking the throttler key + audit IPs.
  // 'loopback, linklocal, uniquelocal' = trust LAN proxies, NOT random clients.
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (k: string, v: unknown) => void;
  };
  expressApp.set('trust proxy', 'loopback, linklocal, uniquelocal');

  // ── security headers ───────────────────────────────────
  // Must run BEFORE any route handler so headers attach to every response.
  app.use(helmet(buildHelmetOptions()));

  // ── cookies ─────────────────────────────────────────────
  // Needed for the httpOnly refresh-token cookie (C11 — pending).
  // The COOKIE_SECRET env var enables signed cookies; missing → unsigned (dev).
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // ── HTTPS redirect (production only) ───────────────────
  if (process.env.NODE_ENV === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.header('x-forwarded-proto') === 'https') return next();
      // Build the absolute HTTPS URL preserving the original path
      const host = req.header('host') ?? '';
      return res.redirect(308, `https://${host}${req.url}`);
    });
  }

  // ── API prefix ─────────────────────────────────────────
  app.setGlobalPrefix('api/v1', {
    // Health checks are mounted at `/health` (no prefix) so probes can hit
    // them at a stable URL regardless of API versioning.
    exclude: ['/health', '/health/(.*)'],
  });

  // ── CORS ──────────────────────────────────────────────
  // Dynamic whitelist with per-environment origins (see cors.config.ts).
  app.enableCors(buildCorsOptions());

  // ── Validation ────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,             // strip unknown properties
      forbidNonWhitelisted: true,  // reject unknown properties (mass-assignment defense)
      transform: true,             // auto-instance DTOs
      transformOptions: {
        // Explicit ONLY — implicit conversion silently coerces 'true' → true,
        // 'NaN' → 0 etc., which has bit us before. Force explicit @Type().
        enableImplicitConversion: false,
      },
      // In production, do NOT echo the offending field names back to the
      // client — they can be enumerated for schema discovery.
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // ── Swagger / OpenAPI ─────────────────────────────────
  // Disabled in production by default (DOCS_ENABLED=true to expose).
  if (process.env.NODE_ENV !== 'production' || process.env.DOCS_ENABLED === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Construction SaaS API')
      .setDescription(
        'Enterprise-grade construction project management API.\n\n' +
          '**Modules:** Auth, Companies, Users, Projects, Phases, Updates, Media, Payments, Comments, SubContractors, Chat, Audit.\n\n' +
          '**Authentication:** All endpoints require a JWT Bearer token from Supabase Auth.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase Auth JWT token',
        },
        'access-token',
      )
      .addTag('auth', 'Authentication & registration')
      .addTag('health', 'Liveness & readiness')
      .addTag('companies', 'Company management')
      .addTag('users', 'User management & invitations')
      .addTag('projects', 'Project CRUD & assignments')
      .addTag('phases', 'Phase management')
      .addTag('updates', 'Daily updates lifecycle')
      .addTag('media', 'File uploads & management')
      .addTag('payments', 'Financial records')
      .addTag('comments', 'Threaded comments')
      .addTag('sub-contractors', 'Subcontractor management')
      .addTag('chat', 'Project chat rooms')
      .addTag('audit', 'Audit logs')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
      },
      customSiteTitle: 'Construction SaaS — API Docs',
    });
  }

  // ── Graceful shutdown ─────────────────────────────────
  // Without this, in-flight requests get killed mid-flight on SIGTERM,
  // which means torn transactions on the DB side. enableShutdownHooks
  // makes Nest run OnModuleDestroy / OnApplicationShutdown handlers in
  // order, including PrismaService closing its pool.
  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);

  logger.log(`🚀 API ready  http://localhost:${port}/api/v1`);
  logger.log(`❤️  Health    http://localhost:${port}/health`);
  if (process.env.NODE_ENV !== 'production' || process.env.DOCS_ENABLED === 'true') {
    logger.log(`📖 Docs      http://localhost:${port}/docs`);
  }
  logger.log(`📋 Env       ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap().catch((err) => {
  // Bootstrap errors are unrecoverable — crash loud, let the orchestrator restart.
  // eslint-disable-next-line no-console
  console.error('FATAL: bootstrap failed', err);
  process.exit(1);
});
