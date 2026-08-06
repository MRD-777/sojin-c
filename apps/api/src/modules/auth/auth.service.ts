// ============================================
// Auth Service — Enterprise-Grade
// Multi-layer validation + Supabase Auth integration
// Atomic transactions + proper rollback
// ============================================
import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { AuditAction } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  BusinessException,
  SystemException,
} from '../../common/errors/app-exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { SUPABASE_ADMIN_CLIENT } from '../../common/supabase/supabase-admin.provider';
import { RegisterCompanyDto, LoginDto, RefreshTokenDto } from './dto';
import { LoginAttemptsTracker } from './login-attempts.tracker';

export interface LoginResult {
  accessToken: string;
  /** Refresh token — controller MUST move this into an httpOnly cookie. */
  refreshToken: string;
  expiresAt: number | undefined;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    specialty: string | null;
    avatar: string | null;
    preferredLanguage: string;
    company: {
      id: string;
      name: string;
      slug: string;
      logo: string | null;
    };
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loginAttempts: LoginAttemptsTracker,
    private readonly auditLog: AuditLogService,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Register a new company with its Super Admin
   * Flow: Validate → Supabase Auth → DB Transaction (Company + User + audit) → Rollback on failure
   *
   * Audit trail (A1): the registration is the most consequential action in
   * the system (creates a tenant from nothing). Two append-only entries are
   * written INSIDE the same transaction as the DB writes — Company.CREATE
   * and User.CREATE. If either audit insert fails, the whole transaction
   * rolls back; we'd rather make the customer retry than let an unaudited
   * tenant exist.
   */
  async registerCompany(dto: RegisterCompanyDto, req?: Request) {
    // --- Layer 1: Business validation ---
    await this.validateRegistration(dto);

    // --- Layer 2: Create Supabase auth user ---
    const { data: authData, error: authError } =
      await this.supabase.auth.admin.createUser({
        email: dto.adminEmail,
        password: dto.adminPassword,
        email_confirm: true,
        user_metadata: {
          name: dto.adminName,
          role: 'super_admin',
        },
      });

    if (authError) {
      this.logger.error(`Supabase auth creation failed for ${dto.adminEmail}`, authError.message);

      if (authError.message?.includes('already registered') ||
          authError.message?.includes('already been registered')) {
        throw new BusinessException({
          code: ErrorCodes.AUTH_BIZ_002,
          userMessage: 'هذا البريد مسجل بالفعل',
          devMessage: `Supabase reported email already exists for ${dto.adminEmail}`,
          status: HttpStatus.CONFLICT,
        });
      }

      throw new SystemException({
        code: ErrorCodes.AUTH_SYS_001,
        devMessage: `Supabase admin createUser failed: ${authError.message}`,
        userMessage: 'حدث خطأ في النظام — تم إبلاغ الفريق التقني',
        cause: authError,
      });
    }

    const supabaseUserId = authData.user.id;

    // --- Layer 3: Create DB records in transaction ---
    try {
      // Reserve a unique slug BEFORE entering the transaction so a collision
      // (extremely unlikely with crypto-random, but possible) doesn't waste
      // a transaction slot. The loop tries up to 5 random suffixes.
      const slug = await this.reserveUniqueSlug(dto.companyName);

      const result = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: dto.companyName.trim(),
            slug,
            email: dto.companyEmail.toLowerCase().trim(),
            phone: dto.companyPhone?.trim() || null,
          },
        });

        const user = await tx.user.create({
          data: {
            companyId: company.id,
            supabaseAuthId: supabaseUserId,
            name: dto.adminName.trim(),
            email: dto.adminEmail.toLowerCase().trim(),
            role: 'SUPER_ADMIN',
          },
        });

        // Audit BOTH creates inside the transaction. The userId/userRole here
        // is the newly-created super admin — there is no "actor" before this
        // call (self-service registration). This is the documented pattern
        // for first-touch tenant creation.
        await this.auditLog.logInTransaction(tx, {
          companyId: company.id,
          userId: user.id,
          userRole: user.role,
          entityType: 'company',
          entityId: company.id,
          action: AuditAction.CREATE,
          oldValues: null,
          newValues: {
            name: company.name,
            slug: company.slug,
            email: company.email,
            phone: company.phone,
          },
          req,
        });

        await this.auditLog.logInTransaction(tx, {
          companyId: company.id,
          userId: user.id,
          userRole: user.role,
          entityType: 'user',
          entityId: user.id,
          action: AuditAction.CREATE,
          oldValues: null,
          // Never log the password or supabaseAuthId — the audit log redacts
          // sensitive keys but we keep the payload minimal anyway.
          newValues: {
            name: user.name,
            email: user.email,
            role: user.role,
          },
          req,
        });

        return { company, user };
      });

      this.logger.log(
        `✅ Company registered: "${result.company.name}" [${result.company.id}] by ${result.user.email}`,
      );

      return {
        company: {
          id: result.company.id,
          name: result.company.name,
          slug: result.company.slug,
        },
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      };
    } catch (dbError: unknown) {
      // 🔴 CRITICAL: Rollback Supabase user if DB transaction fails
      this.logger.error('DB transaction failed — rolling back Supabase user', dbError);

      try {
        await this.supabase.auth.admin.deleteUser(supabaseUserId);
        this.logger.warn(`Rolled back Supabase user: ${supabaseUserId}`);
      } catch (rollbackError) {
        // This is a critical inconsistency — log for manual cleanup
        this.logger.error(
          `🔴 CRITICAL: Failed to rollback Supabase user ${supabaseUserId}. Manual cleanup required!`,
          rollbackError,
        );
      }

      throw new SystemException({
        code: ErrorCodes.AUTH_SYS_002,
        devMessage: 'DB transaction failed during registerCompany — Supabase rollback attempted',
        userMessage: 'حدث خطأ في النظام — تم إبلاغ الفريق التقني',
        cause: dbError,
      });
    }
  }

  /**
   * Login — authenticates via Supabase and returns:
   *   - accessToken (in JSON, short-lived 15min)
   *   - refreshToken (the caller — AuthController — places it in an
   *     httpOnly+Secure+SameSite cookie; NEVER returned in the JSON)
   *   - user payload
   *
   * Lockout: after 5 consecutive failures the email is locked for 15 minutes.
   * Lock check happens BEFORE we even talk to Supabase — saves an upstream
   * round-trip on an obvious abuse path.
   */
  async login(dto: LoginDto): Promise<LoginResult> {
    const email = dto.email.toLowerCase().trim();

    // ── Lockout pre-check (I5) ────────────────────────────
    const lock = this.loginAttempts.check(email);
    if (lock.locked) {
      throw new BusinessException({
        code: ErrorCodes.AUTH_BIZ_001,
        userMessage: `الحساب مقفل مؤقتاً بسبب محاولات فاشلة متكررة. حاول بعد ${Math.ceil(lock.retryAfterSeconds / 60)} دقيقة.`,
        devMessage: `Account locked for ${this.maskEmail(email)} — ${lock.retryAfterSeconds}s remaining`,
        status: HttpStatus.TOO_MANY_REQUESTS,
        context: { retryAfter: lock.retryAfterSeconds },
      });
    }

    // ── Supabase auth ────────────────────────────────────
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password: dto.password,
    });

    if (error) {
      const updated = this.loginAttempts.recordFailure(email);
      this.logger.warn(
        `Failed login attempt #${updated.failures} for: ${this.maskEmail(email)}`,
      );
      // ⚠️ Constant-time-ish: same message whether email exists or password is wrong
      throw new BusinessException({
        code: ErrorCodes.AUTH_BIZ_006,
        userMessage: 'البريد أو كلمة المرور غير صحيحة',
        devMessage: `Supabase signInWithPassword rejected for ${this.maskEmail(email)}: ${error.message}`,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // ── Load DB-side user ────────────────────────────────
    const user = await this.prisma.user.findFirst({
      where: {
        supabaseAuthId: data.user.id,
        deletedAt: null,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            subscriptionStatus: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!user) {
      // Supabase says yes but our DB doesn't know them — should be impossible
      // post-onboarding. Treat as auth failure but DO record it (operator alert).
      this.loginAttempts.recordFailure(email);
      this.logger.warn(`Supabase user ${data.user.id} has no DB record`);
      throw new SystemException({
        code: ErrorCodes.AUTH_SYS_002,
        devMessage: `Supabase user ${data.user.id} has no DB record — IdP/DB inconsistency`,
        userMessage: 'حدث خطأ في النظام — تم إبلاغ الفريق التقني',
      });
    }

    if (!user.isActive) {
      throw new BusinessException({
        code: ErrorCodes.AUTH_BIZ_004,
        userMessage: 'الحساب معطل — تواصل مع المسؤول',
        devMessage: `Deactivated user ${user.id} attempted login`,
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    if (user.company.deletedAt) {
      throw new BusinessException({
        code: ErrorCodes.AUTH_BIZ_007,
        userMessage: 'حساب الشركة غير متاح',
        devMessage: `Soft-deleted company ${user.company.id}`,
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    if (user.company.subscriptionStatus === 'EXPIRED') {
      throw new BusinessException({
        code: ErrorCodes.AUTH_BIZ_003,
        userMessage: 'اشتراك الشركة منتهي — يرجى التجديد',
        devMessage: `Expired subscription for company ${user.company.id}`,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // Success — clear the failure counter for this email
    this.loginAttempts.recordSuccess(email);

    // Update lastLogin fire-and-forget — failure here mustn't block login
    this.prisma.user
      .update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      })
      .catch((err) => this.logger.error('Failed to update lastLogin', err));

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token, // controller puts in cookie
      expiresAt: data.session.expires_at,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        specialty: user.specialty,
        avatar: user.avatar,
        preferredLanguage: user.preferredLanguage,
        company: {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
          logo: user.company.logo,
        },
      },
    };
  }

  /**
   * Refresh access token. The refresh token comes from the httpOnly cookie
   * the controller passes in — NOT from the request body. Returning the
   * refreshed token in JSON would expose it to any XSS in the SPA; the
   * controller will reset the cookie with the rotated token instead.
   */
  async refreshToken(currentRefreshToken: string | undefined) {
    if (!currentRefreshToken) {
      throw new BusinessException({
        code: ErrorCodes.AUTH_BIZ_005,
        userMessage: 'انتهت الجلسة — سجل دخول مجدداً',
        devMessage: 'Refresh attempted without refresh_token cookie',
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: currentRefreshToken,
    });

    if (error || !data.session) {
      // Could be an attacker replaying a stolen token, or just an expired
      // session. Either way, force a re-login.
      this.logger.warn(
        `Refresh failed: ${error?.message ?? 'no session'} — forcing re-login`,
      );
      throw new BusinessException({
        code: ErrorCodes.AUTH_BIZ_005,
        userMessage: 'انتهت الجلسة — سجل دخول مجدداً',
        devMessage: `Supabase refresh failed: ${error?.message ?? 'no session'}`,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    return {
      accessToken: data.session.access_token,
      // The CONTROLLER puts this into the cookie; never JSON-returned.
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    };
  }

  /**
   * Logout. Always succeeds from the client's perspective — clearing the
   * cookie is the real guarantee. We attempt to invalidate the Supabase
   * session as a best effort.
   */
  async logout(accessToken: string | undefined) {
    if (accessToken) {
      try {
        await this.supabase.auth.admin.signOut(accessToken);
      } catch {
        // Already expired — that's fine
        this.logger.warn('Logout called with possibly expired token');
      }
    }
    return { message: 'تم تسجيل الخروج بنجاح' };
  }

  /**
   * Two-char prefix + domain; rest is asterisks. Used to keep PII out of logs.
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '[masked]';
    return `${local.slice(0, 2)}***@${domain}`;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Validate registration data against business rules
   */
  private async validateRegistration(dto: RegisterCompanyDto): Promise<void> {
    // Check company email uniqueness
    const existingCompany = await this.prisma.company.findFirst({
      where: { email: dto.companyEmail.toLowerCase().trim(), deletedAt: null },
    });
    if (existingCompany) {
      throw new BusinessException({
        code: ErrorCodes.AUTH_BIZ_002,
        userMessage: 'هذا البريد مسجل بالفعل لشركة أخرى',
        devMessage: `Company email collision: ${dto.companyEmail}`,
        status: HttpStatus.CONFLICT,
      });
    }

    // Check admin email uniqueness within active users
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.adminEmail.toLowerCase().trim(), deletedAt: null },
    });
    if (existingUser) {
      throw new BusinessException({
        code: ErrorCodes.AUTH_BIZ_002,
        userMessage: 'هذا البريد مسجل بالفعل لمستخدم آخر',
        devMessage: `Admin email collision: ${dto.adminEmail}`,
        status: HttpStatus.CONFLICT,
      });
    }
  }

  /**
   * Build a URL-safe slug stem from the company name.
   * - Drops everything that's not ASCII alnum (Arabic \u21D2 dashes \u2014 we'd need
   *   a proper transliteration library to do better; the prior regex was
   *   buggy and reinserted the Arabic chars).
   * - Caps at 40 chars to leave room for the random suffix.
   * - Falls back to "company" if the name is all non-ASCII.
   */
  private slugStem(companyName: string): string {
    const stem = companyName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 40);
    return stem || 'company';
  }

  /**
   * Reserve a unique slug by combining a stem with a cryptographic suffix.
   *
   * Why not `Date.now().toString(36)`:
   *   Date.now() returns milliseconds. Two registrations in the same ms
   *   (load-balanced API + retry from client) produce the SAME slug. The
   *   second `Company.create()` then fails on the unique index, and the
   *   whole transaction rolls back. We've seen this in practice.
   *
   * Strategy:
   *   - Suffix is 6 bytes (48 bits) of crypto-random \u2192 ~2.8e14 distinct
   *     values per stem. Birthday collision at the millionth company.
   *   - Probe the DB; on the freak chance of collision, regenerate (max 5
   *     attempts before bailing out with a 500).
   */
  private async reserveUniqueSlug(companyName: string): Promise<string> {
    const stem = this.slugStem(companyName);

    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = randomBytes(6).toString('base64url').toLowerCase();
      const candidate = `${stem}-${suffix}`;

      const collision = await this.prisma.company.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!collision) return candidate;

      this.logger.warn(
        `Slug collision on attempt ${attempt + 1}: ${candidate} \u2014 retrying`,
      );
    }

    // 5 collisions in a row on a 48-bit random space \u2014 something is broken.
    this.logger.error(
      'Slug generation exhausted 5 attempts \u2014 possible DB inconsistency',
    );
    throw new SystemException({
      code: ErrorCodes.AUTH_SYS_002,
      devMessage: 'Slug generation exhausted 5 attempts \u2014 possible DB inconsistency',
      userMessage: '\u0641\u0634\u0644 \u0641\u064A \u0625\u0646\u0634\u0627\u0621 \u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0634\u0631\u0643\u0629 \u2014 \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B',
    });
  }
}
