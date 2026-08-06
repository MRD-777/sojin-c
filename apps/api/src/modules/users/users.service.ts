// =============================================
// 👤 Users Service — Enterprise Business Logic
// =============================================
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TierLimitsService } from '../companies/tier-limits.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateMyProfileDto,
  ChangeRoleDto,
  UpdatePermissionsDto,
  ListUsersQueryDto,
} from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, Prisma, UserRole } from '@prisma/client';
import { Request } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../common/supabase/supabase-admin.provider';

/** Fields safe to return to API consumers — never expose auth IDs */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  specialty: true,
  avatar: true,
  isActive: true,
  preferredLanguage: true,
  lastLogin: true,
  createdAt: true,
  customPermissions: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly tierLimits: TierLimitsService,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  // ─── List Users ─────────────────────────────
  async findAll(companyId: string, query: ListUsersQueryDto) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.UserWhereInput = {
      companyId,
      ...this.prisma.softDeleteFilter,
    };

    if (query.role) where.role = query.role as UserRole;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Get Single User ───────────────────────
  async findOne(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, ...this.prisma.softDeleteFilter },
      select: {
        ...USER_SELECT,
        notificationPreferences: true,
        projectAssignments: {
          where: { removedAt: null },
          select: {
            id: true,
            roleInProject: true,
            isRequiredDailyUpdate: true,
            assignedAt: true,
            project: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return user;
  }

  // ─── Get My Profile ─────────────────────────
  async getMyProfile(user: JwtPayload) {
    return this.findOne(user.companyId, user.userId);
  }

  // ─── Update My Profile ──────────────────────
  /**
   * Self-edit of identity fields. Audited (A5) — name/phone/avatar are PII
   * that an attacker with an XSS foothold would race to change before the
   * user notices. The oldValues snapshot lets a forensic investigator
   * reconstruct who the account belonged to at the time of compromise.
   */
  async updateMyProfile(
    user: JwtPayload,
    dto: UpdateMyProfileDto,
    req: Request,
  ) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;
    if (dto.notificationPreferences !== undefined)
      data.notificationPreferences =
        dto.notificationPreferences as Prisma.InputJsonValue;
    if (dto.preferredLanguage !== undefined)
      data.preferredLanguage = dto.preferredLanguage as 'AR' | 'EN';

    // Snapshot only the fields we're about to overwrite — keeps audit rows
    // tight and prevents accidentally including unrelated columns.
    const oldValues: Record<string, unknown> = {};
    if (Object.keys(data).length > 0) {
      const current = await this.prisma.user.findFirst({
        where: { id: user.userId, ...this.prisma.softDeleteFilter },
        select: {
          name: true,
          phone: true,
          avatar: true,
          notificationPreferences: true,
          preferredLanguage: true,
        },
      });
      if (current) {
        if (data.name !== undefined) oldValues.name = current.name;
        if (data.phone !== undefined) oldValues.phone = current.phone;
        if (data.avatar !== undefined) oldValues.avatar = current.avatar;
        if (data.notificationPreferences !== undefined)
          oldValues.notificationPreferences = current.notificationPreferences;
        if (data.preferredLanguage !== undefined)
          oldValues.preferredLanguage = current.preferredLanguage;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.userId },
        select: USER_SELECT,
        data,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'user',
        entityId: user.userId,
        action: AuditAction.UPDATE,
        oldValues,
        newValues: data as Record<string, unknown>,
        req,
      });

      return updated;
    });
  }

  // ─── Create (Invite) User ──────────────────
  /**
   * Admin-initiated user creation (A4 workaround).
   *
   * Production design: send an invite email with a one-time set-password
   * link. That requires NotificationsModule (BullMQ) which is still
   * commented out (Phase 1 P0 remaining).
   *
   * Interim contract (Q1=A, approved 2026-05-16):
   *   - If the admin provides `password` in the DTO, we use it as-is.
   *   - Otherwise we generate a secure temp password.
   *   - The temp password is returned ONCE in the HTTP response, alongside
   *     a `mustSharePasswordSecurely` warning string. The admin is then
   *     responsible for handing it to the new user (Slack/WhatsApp/in-person).
   *
   * Why this is acceptable as a stopgap:
   *   - The endpoint is behind @Roles('SUPER_ADMIN') + JWT auth.
   *   - The response goes over TLS to a single admin browser.
   *   - The password is never persisted in our DB (Supabase Auth owns it)
   *     and never logged (the audit-log redactor blocks the `password` key).
   *
   * What this is NOT:
   *   - This is NOT a long-term design. When NotificationsModule lands,
   *     replace this with: create user with random unknown password +
   *     issue a one-time set-password token + email the link.
   */
  async create(adminUser: JwtPayload, dto: CreateUserDto, req: Request) {
    // 0. Plan limit gate — 402 if exceeded, with the next-tier hint.
    //    Check BEFORE creating in Supabase so we don't leave orphan auth users.
    await this.tierLimits.assertCanAddUser(adminUser.companyId);

    // 1. Check for duplicate email within company
    const existing = await this.prisma.user.findFirst({
      where: {
        companyId: adminUser.companyId,
        email: dto.email,
        ...this.prisma.softDeleteFilter,
      },
    });
    if (existing) {
      throw new ConflictException('بريد إلكتروني مسجل بالفعل في الشركة');
    }

    // 2. Create user in Supabase Auth
    const adminProvidedPassword = Boolean(dto.password);
    const tempPassword = dto.password || this.generateSecurePassword();
    const { data: authData, error: authError } =
      await this.supabaseAdmin.auth.admin.createUser({
        email: dto.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: dto.name, role: dto.role },
      });

    if (authError) {
      this.logger.error(`Supabase user creation failed: ${authError.message}`);
      throw new BadRequestException('فشل في إنشاء حساب المصادقة');
    }

    try {
      // 3. Create user in our database + audit in a single transaction.
      //    If the audit fails, the user row rolls back. The Supabase user
      //    is then cleaned up below (the outer catch).
      const newUser = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            companyId: adminUser.companyId,
            supabaseAuthId: authData.user.id,
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            role: dto.role as UserRole,
            specialty: dto.specialty,
          },
          select: USER_SELECT,
        });

        await this.auditLog.logInTransaction(tx, {
          companyId: adminUser.companyId,
          userId: adminUser.userId,
          userRole: adminUser.role,
          entityType: 'user',
          entityId: created.id,
          action: AuditAction.CREATE,
          oldValues: null,
          newValues: { name: dto.name, email: dto.email, role: dto.role },
          req,
        });

        return created;
      });

      // Only surface the temp password when WE generated it. If the admin
      // supplied one, they already know it — echoing it back is needless
      // exposure on the response wire.
      if (adminProvidedPassword) {
        return { user: newUser };
      }

      return {
        user: newUser,
        tempPassword,
        mustSharePasswordSecurely:
          'كلمة المرور المؤقتة تظهر مرة واحدة فقط. سلّمها للمستخدم بأمان (يفضل قناة مشفرة) — ولن تستطيع استرجاعها بعد إغلاق هذه النافذة.',
      };
    } catch (dbError) {
      // Rollback Supabase user if DB insert (or audit) fails
      await this.supabaseAdmin.auth.admin
        .deleteUser(authData.user.id)
        .catch((e) => this.logger.error('Supabase rollback failed', e));
      throw dbError;
    }
  }

  // ─── Update User (Admin) ───────────────────
  async update(
    adminUser: JwtPayload,
    targetUserId: string,
    dto: UpdateUserDto,
    req: Request,
  ) {
    const target = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: adminUser.companyId,
        ...this.prisma.softDeleteFilter,
      },
    });

    if (!target) throw new NotFoundException('المستخدم غير موجود');

    // Whitelist updatable fields — DO NOT pass `dto` raw. The DTO might
    // (intentionally or via mass-assignment attack) include `role`,
    // `companyId`, `supabaseAuthId` — none of which are mutable here.
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.specialty !== undefined) data.specialty = dto.specialty;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;
    if (dto.preferredLanguage !== undefined) {
      data.preferredLanguage = dto.preferredLanguage as 'AR' | 'EN';
    }

    // Snapshot oldValues for ONLY the fields about to change (CVE-USERS-004).
    // The previous implementation snapshotted name+phone unconditionally,
    // leaving specialty/avatar/preferredLanguage history out of the audit
    // trail — a forensic gap when those fields were the ones modified.
    const oldValues: Record<string, unknown> = {};
    if (data.name !== undefined) oldValues.name = target.name;
    if (data.phone !== undefined) oldValues.phone = target.phone;
    if (data.specialty !== undefined) oldValues.specialty = target.specialty;
    if (data.avatar !== undefined) oldValues.avatar = target.avatar;
    if (data.preferredLanguage !== undefined)
      oldValues.preferredLanguage = target.preferredLanguage;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data,
        select: USER_SELECT,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: adminUser.companyId,
        userId: adminUser.userId,
        userRole: adminUser.role,
        entityType: 'user',
        entityId: targetUserId,
        action: AuditAction.UPDATE,
        oldValues,
        newValues: data as Record<string, unknown>,
        req,
      });

      return updated;
    });
  }

  // ─── Change Role ───────────────────────────
  async changeRole(
    adminUser: JwtPayload,
    targetUserId: string,
    dto: ChangeRoleDto,
    req: Request,
  ) {
    // Prevent self-role-change
    if (adminUser.userId === targetUserId) {
      throw new ForbiddenException('لا يمكنك تغيير دورك بنفسك');
    }

    const target = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: adminUser.companyId,
        ...this.prisma.softDeleteFilter,
      },
    });

    if (!target) throw new NotFoundException('المستخدم غير موجود');

    // Prevent removing last SUPER_ADMIN
    if (target.role === 'SUPER_ADMIN' && dto.role !== 'SUPER_ADMIN') {
      await this.ensureNotLastSuperAdmin(adminUser.companyId, targetUserId);
    }

    const oldRole = target.role;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { role: dto.role as UserRole },
        select: USER_SELECT,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: adminUser.companyId,
        userId: adminUser.userId,
        userRole: adminUser.role,
        entityType: 'user',
        entityId: targetUserId,
        action: AuditAction.UPDATE,
        oldValues: { role: oldRole },
        newValues: { role: dto.role },
        req,
      });

      return updated;
    });
  }

  // ─── Update Custom Permissions ─────────────
  async updatePermissions(
    adminUser: JwtPayload,
    targetUserId: string,
    dto: UpdatePermissionsDto,
    req: Request,
  ) {
    const target = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: adminUser.companyId,
        ...this.prisma.softDeleteFilter,
      },
    });

    if (!target) throw new NotFoundException('المستخدم غير موجود');

    // Validate permission format: resource.action
    for (const perm of dto.permissions) {
      if (!/^[a-z_]+\.[a-z_]+$/.test(perm)) {
        throw new BadRequestException(
          `صلاحية غير صالحة: "${perm}" — الشكل الصحيح: resource.action`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { customPermissions: dto.permissions },
        select: USER_SELECT,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: adminUser.companyId,
        userId: adminUser.userId,
        userRole: adminUser.role,
        entityType: 'user',
        entityId: targetUserId,
        action: AuditAction.UPDATE,
        oldValues: { customPermissions: target.customPermissions },
        newValues: { customPermissions: dto.permissions },
        req,
      });

      return updated;
    });
  }

  // ─── Deactivate User ───────────────────────
  /**
   * Deactivate a user: DB flag + Supabase ban (A3).
   *
   * Without the Supabase ban, a deactivated user with a still-valid refresh
   * token could keep minting access tokens from the identity provider —
   * each one would then be rejected by JwtStrategy (isActive=false), but
   * the upstream identity still considers them a live account. The ban
   * cuts the session at the IdP layer.
   *
   * Ban duration is 24h — `deactivate` is meant to be reversible by
   * `activate`. For permanent removal use `softDelete` which bans for 100y.
   * The ban operation runs AFTER the DB tx commits: a failed ban must not
   * roll back the DB state (the DB-side isActive=false already protects
   * our API surface).
   */
  async deactivate(adminUser: JwtPayload, targetUserId: string, req: Request) {
    if (adminUser.userId === targetUserId) {
      throw new ForbiddenException('لا يمكنك تعطيل حسابك بنفسك');
    }

    const target = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: adminUser.companyId,
        ...this.prisma.softDeleteFilter,
      },
    });

    if (!target) throw new NotFoundException('المستخدم غير موجود');

    if (target.role === 'SUPER_ADMIN') {
      await this.ensureNotLastSuperAdmin(adminUser.companyId, targetUserId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: targetUserId },
        data: { isActive: false },
        select: USER_SELECT,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: adminUser.companyId,
        userId: adminUser.userId,
        userRole: adminUser.role,
        entityType: 'user',
        entityId: targetUserId,
        action: AuditAction.UPDATE,
        // CVE-TEST-016 — derive from state, not from intended transition.
        // A no-op deactivate (target already inactive) MUST log the true
        // prior state, not the assumed `true`. The forensic trail is only
        // useful if it doesn't lie about no-ops.
        oldValues: { isActive: target.isActive },
        newValues: { isActive: false },
        req,
      });

      return u;
    });

    // Best-effort Supabase ban (A3). Failure does not roll back — the DB
    // flag already blocks the user at JwtStrategy.
    if (target.supabaseAuthId) {
      await this.supabaseAdmin.auth.admin
        .updateUserById(target.supabaseAuthId, { ban_duration: '24h' })
        .catch((e) =>
          this.logger.error(
            `Failed to ban Supabase user ${target.supabaseAuthId} on deactivate — manual reconciliation may be required`,
            e,
          ),
        );
    }

    return updated;
  }

  // ─── Activate User ─────────────────────────
  /**
   * Re-enable a user: DB flag + lift the Supabase ban (A3 counterpart).
   * Passing `ban_duration: 'none'` clears whatever ban deactivate set.
   */
  async activate(adminUser: JwtPayload, targetUserId: string, req: Request) {
    const target = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: adminUser.companyId,
        ...this.prisma.softDeleteFilter,
      },
    });

    if (!target) throw new NotFoundException('المستخدم غير موجود');

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: targetUserId },
        data: { isActive: true },
        select: USER_SELECT,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: adminUser.companyId,
        userId: adminUser.userId,
        userRole: adminUser.role,
        entityType: 'user',
        entityId: targetUserId,
        action: AuditAction.UPDATE,
        // CVE-TEST-016 — same state-derived rule as deactivate. A no-op
        // activate on an already-active user MUST NOT log a fake
        // `false → true` transition.
        oldValues: { isActive: target.isActive },
        newValues: { isActive: true },
        req,
      });

      return u;
    });

    // Lift any existing Supabase ban — also best-effort.
    if (target.supabaseAuthId) {
      await this.supabaseAdmin.auth.admin
        .updateUserById(target.supabaseAuthId, { ban_duration: 'none' })
        .catch((e) =>
          this.logger.error(
            `Failed to unban Supabase user ${target.supabaseAuthId} on activate — user may still be IdP-blocked`,
            e,
          ),
        );
    }

    return updated;
  }

  // ─── Soft Delete User ──────────────────────
  async softDelete(
    adminUser: JwtPayload,
    targetUserId: string,
    reason: string,
    req: Request,
  ) {
    if (adminUser.userId === targetUserId) {
      throw new ForbiddenException('لا يمكنك حذف حسابك بنفسك');
    }

    if (!reason || reason.trim().length < 20) {
      throw new BadRequestException(
        'سبب حذف المستخدم مطلوب (20 حرف على الأقل)',
      );
    }

    const target = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: adminUser.companyId,
        ...this.prisma.softDeleteFilter,
      },
    });

    if (!target) throw new NotFoundException('المستخدم غير موجود');

    if (target.role === 'SUPER_ADMIN') {
      await this.ensureNotLastSuperAdmin(adminUser.companyId, targetUserId);
    }

    // Soft delete + audit in a single transaction. The Supabase ban happens
    // AFTER the transaction commits — if the transaction rolls back, we don't
    // want to leave a banned auth user behind.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { deletedAt: new Date(), isActive: false },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: adminUser.companyId,
        userId: adminUser.userId,
        userRole: adminUser.role,
        entityType: 'user',
        entityId: targetUserId,
        action: AuditAction.DELETE,
        oldValues: {
          name: target.name,
          email: target.email,
          role: target.role,
          isActive: target.isActive,
        },
        newValues: null,
        reason,
        req,
      });
    });

    // Disable in Supabase Auth — best-effort. If this fails, the user is
    // already DB-soft-deleted and isActive=false; subsequent JWT validations
    // in JwtStrategy will reject them anyway.
    if (target.supabaseAuthId) {
      await this.supabaseAdmin.auth.admin
        .updateUserById(target.supabaseAuthId, { ban_duration: '876000h' })
        .catch((e) =>
          this.logger.error(
            `Failed to ban Supabase user ${target.supabaseAuthId} — manual cleanup required`,
            e,
          ),
        );
    }

    return { message: 'تم حذف المستخدم بنجاح' };
  }

  // ─── Helpers ───────────────────────────────

  /**
   * Prevent removing the last SUPER_ADMIN from the company.
   */
  private async ensureNotLastSuperAdmin(companyId: string, excludeUserId: string) {
    const count = await this.prisma.user.count({
      where: {
        companyId,
        role: 'SUPER_ADMIN',
        isActive: true,
        id: { not: excludeUserId },
        ...this.prisma.softDeleteFilter,
      },
    });

    if (count === 0) {
      throw new ForbiddenException(
        'لا يمكن إزالة آخر مدير أعلى في الشركة — يجب أن يكون هناك مدير واحد على الأقل',
      );
    }
  }

  /**
   * Generate a cryptographically secure temporary password (CVE-USERS-003).
   *
   * Uses rejection sampling to avoid modulo bias: `byte % 62` would map the
   * 256 possible byte values onto 62 characters unevenly (the first 8 chars
   * would be ~25% more likely than the rest). We reject bytes outside the
   * largest multiple-of-62 range (0..247) and resample.
   *
   * Worst-case rejection rate: 8/256 ≈ 3% — negligible for a 16-char output.
   */
  private generateSecurePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    const length = 16;
    const charsetSize = chars.length;
    const maxValid = Math.floor(256 / charsetSize) * charsetSize; // 248 for 62 chars
    const { randomFillSync } = require('crypto') as typeof import('crypto');

    const out: string[] = [];
    // Refill a buffer as needed so we never block waiting for entropy.
    const refill = (): Uint8Array => randomFillSync(new Uint8Array(length * 2));
    let buf = refill();
    let i = 0;
    while (out.length < length) {
      if (i >= buf.length) {
        buf = refill();
        i = 0;
      }
      const b = buf[i++];
      if (b < maxValid) out.push(chars[b % charsetSize]);
    }
    return out.join('');
  }
}
