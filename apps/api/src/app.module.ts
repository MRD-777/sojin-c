// ============================================
// 🏗️ Construction SaaS — Root Module
// ============================================
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Core modules
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

// Feature modules
import { AuditModule } from './modules/audit/audit.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PhasesModule } from './modules/phases/phases.module';
import { UpdatesModule } from './modules/updates/updates.module';
import { MediaModule } from './modules/media/media.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FinanceModule } from './modules/finance/finance.module';
import { CommentsModule } from './modules/comments/comments.module';
import { SubContractorsModule } from './modules/sub-contractors/sub-contractors.module';
import { ChatModule } from './modules/chat/chat.module';

// Guards
import { JwtAuthGuard, RolesGuard, PermissionsGuard } from './common/guards';

// Interceptors
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// Filters
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

// Middleware
import { TenantIsolationMiddleware } from './common/middleware/tenant-isolation.middleware';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

// Config
import { throttlerConfig } from './common/config/throttler.config';

// Cross-cutting infrastructure
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { SupabaseAdminModule } from './common/supabase/supabase-admin.provider';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting — three named profiles (default 100/min, auth 5/min, heavy 10/min)
    ThrottlerModule.forRoot(throttlerConfig),

    // Cross-cutting infra
    IdempotencyModule,
    SupabaseAdminModule,

    PrismaModule,
    AuthModule,
    HealthModule,

    // Feature modules
    AuditModule,
    CompaniesModule,
    UsersModule,
    ProjectsModule,
    PhasesModule,
    UpdatesModule,
    MediaModule,
    PaymentsModule,
    // Finance owns settings/summary/BOQ; PaymentsModule keeps cash movements.
    FinanceModule,
    CommentsModule,
    SubContractorsModule,
    ChatModule,

    // NotificationsModule (Phase 2 / F5 — depends on Redis + BullMQ)
  ],
  providers: [
    // ⚠️ Guard ORDER MATTERS — they execute top-down.
    //   1. Throttler — cheapest, reject DOS attempts before any DB read
    //   2. JwtAuth — verify identity
    //   3. Roles — check declared role list
    //   4. Permissions — check fine-grained permissions
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },

    // Global response envelope: { success, data, meta }
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },

    // Global error normalization (no leaks)
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // ORDER MATTERS — correlation ID must run FIRST so every downstream
    // middleware / guard / service can see it via RequestContext.
    consumer
      .apply(CorrelationIdMiddleware, TenantIsolationMiddleware)
      .forRoutes('*');
  }
}
