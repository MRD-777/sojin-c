// ============================================
// 💵 Finance Controller — S7 (financial settings + summary + BOQ)
//
// Authorization layers (enforced top-to-bottom):
//   1. JwtAuthGuard   — global, requires a valid Supabase JWT
//   2. RolesGuard     — @Roles() per endpoint (the matrix below)
//   3. Service-level  — ensureProjectAccess (companyId + project access)
//                       + per-resource ownership on :id routes
//
// Roles matrix (00-plan.md, Stage 3):
//   GET    projects/:projectId/financial-settings  SUPER_ADMIN, ACCOUNTANT, PROJECT_MANAGER
//   PATCH  projects/:projectId/financial-settings  SUPER_ADMIN, ACCOUNTANT
//   GET    projects/:projectId/financial-summary   + CLIENT (results only)
//   GET    projects/:projectId/boq                 + CLIENT
//   POST   projects/:projectId/boq                 SUPER_ADMIN, ACCOUNTANT
//   POST   boq/:id/sub-items                       SUPER_ADMIN, ACCOUNTANT
//   PATCH  boq/:id                                 SUPER_ADMIN, ACCOUNTANT
//   DELETE boq/:id                                 SUPER_ADMIN, ACCOUNTANT
//   PATCH  boq/:id/link-update                     + PROJECT_MANAGER, SITE_ENGINEER, SUPERVISOR
//
// ⚠️ @Roles is Layer 2 only. It says WHICH role may call the route, never
// WHICH project — every handler below delegates to a service that runs
// ensureProjectAccess (Layer 3). Never skip it.
// ============================================
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { FinancialSettingsService } from './financial-settings.service';
import { FinancialSummaryService } from './financial-summary.service';
import { BOQService } from './boq.service';
import {
  UpdateFinancialSettingsDto,
  CreateBOQItemDto,
  UpdateBOQItemDto,
  DeleteBOQItemDto,
  LinkUpdateDto,
} from './dto';
import { CurrentUser, JwtPayload, Roles } from '../../common/decorators';
import { Request } from 'express';

@Controller()
export class FinanceController {
  constructor(
    private readonly settingsService: FinancialSettingsService,
    private readonly summaryService: FinancialSummaryService,
    private readonly boqService: BOQService,
  ) {}

  // ─── Financial Settings ────────────────────────────────

  /** GET /api/v1/projects/:projectId/financial-settings */
  @Get('projects/:projectId/financial-settings')
  @Roles('SUPER_ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER')
  getSettings(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.settingsService.get(user, projectId);
  }

  /**
   * PATCH /api/v1/projects/:projectId/financial-settings
   * Upsert + mandatory audit entry (old/new values).
   * PROJECT_MANAGER can READ the settings but not change them — the numbers
   * here drive every downstream money figure.
   */
  @Patch('projects/:projectId/financial-settings')
  @Roles('SUPER_ADMIN', 'ACCOUNTANT')
  updateSettings(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateFinancialSettingsDto,
    @Req() req: Request,
  ) {
    return this.settingsService.update(user, projectId, dto, req);
  }

  // ─── Financial Summary ─────────────────────────────────

  /**
   * GET /api/v1/projects/:projectId/financial-summary
   * Computed per-request from the DB — nothing is stored.
   * CLIENT sees the results (netDue etc.) but NOT the internal inputs.
   */
  @Get('projects/:projectId/financial-summary')
  @Roles('SUPER_ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER', 'CLIENT')
  getSummary(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.summaryService.get(user, projectId);
  }

  // ─── BOQ ───────────────────────────────────────────────

  /** GET /api/v1/projects/:projectId/boq — الشجرة كاملة + completedPct */
  @Get('projects/:projectId/boq')
  @Roles('SUPER_ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER', 'CLIENT')
  getBOQTree(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.boqService.findTree(user, projectId);
  }

  /** POST /api/v1/projects/:projectId/boq — بند رئيسي (parentId = null) */
  @Post('projects/:projectId/boq')
  @Roles('SUPER_ADMIN', 'ACCOUNTANT')
  createBOQItem(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateBOQItemDto,
    @Req() req: Request,
  ) {
    return this.boqService.create(user, projectId, dto, req);
  }

  /**
   * POST /api/v1/boq/:id/sub-items — تفريعة تحت البند :id
   * The project is derived from the PARENT item, never from the body.
   */
  @Post('boq/:id/sub-items')
  @Roles('SUPER_ADMIN', 'ACCOUNTANT')
  createSubItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBOQItemDto,
    @Req() req: Request,
  ) {
    return this.boqService.createSubItem(user, id, dto, req);
  }

  /** PATCH /api/v1/boq/:id */
  @Patch('boq/:id')
  @Roles('SUPER_ADMIN', 'ACCOUNTANT')
  updateBOQItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBOQItemDto,
    @Req() req: Request,
  ) {
    return this.boqService.update(user, id, dto, req);
  }

  /**
   * DELETE /api/v1/boq/:id
   * Soft-delete only. Blocked (400) while the item still has ACTIVE children.
   * `reason` is optional (plan decision #3) — the audit entry is not.
   */
  @Delete('boq/:id')
  @Roles('SUPER_ADMIN', 'ACCOUNTANT')
  @HttpCode(200)
  softDeleteBOQItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteBOQItemDto,
    @Req() req: Request,
  ) {
    return this.boqService.softDelete(user, id, dto, req);
  }

  /**
   * PATCH /api/v1/boq/:id/link-update — ربط تقرير معتمد بالبند
   * Wider role set on purpose (PROJECT_OVERVIEW: site engineers/supervisors
   * link their approved reports to BOQ items). WORKER and CLIENT are excluded.
   */
  @Patch('boq/:id/link-update')
  @Roles(
    'SUPER_ADMIN',
    'ACCOUNTANT',
    'PROJECT_MANAGER',
    'SITE_ENGINEER',
    'SUPERVISOR',
  )
  linkUpdate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkUpdateDto,
    @Req() req: Request,
  ) {
    return this.boqService.linkUpdate(user, id, dto, req);
  }
}
