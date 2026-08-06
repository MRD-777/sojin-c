// ============================================
// 🔍 Audit Controller — Read-only for SUPER_ADMIN
// ============================================
import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles, CurrentUser, JwtPayload } from '../../common/decorators';
import { PaginationDto } from '../../common/dto';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/v1/audit-logs
   * Only SUPER_ADMIN can view audit logs.
   */
  @Get()
  @Roles('SUPER_ADMIN')
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { page = 1, limit = 20, sortOrder = 'desc' } = query;

    const where: Record<string, unknown> = {
      companyId: user.companyId,
    };

    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (from || to) {
      const createdAtFilter: Record<string, Date> = {};
      if (from) createdAtFilter.gte = new Date(from);
      if (to) createdAtFilter.lte = new Date(to);
      where.createdAt = createdAtFilter;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
