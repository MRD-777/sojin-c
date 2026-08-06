// ============================================
// 📝 Updates Controller
//
// Authorization (Layer 2): every endpoint declares its allowed roles.
// CLIENT only appears on read endpoints — the service then narrows the
// rows they see (APPROVED on their own projects only).
// The submitter ownership check (Layer 3) is enforced inside the service.
// ============================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UpdatesService } from './updates.service';
import {
  CreateUpdateDto,
  EditUpdateDto,
  RejectUpdateDto,
  ForceCancelDto,
  EditApprovedDto,
  ListUpdatesQueryDto,
} from './dto';
import {
  CurrentUser,
  IdempotencyKey,
  JwtPayload,
  Roles,
} from '../../common/decorators';
import { Request } from 'express';

/** Roles that may participate in the update lifecycle (excludes CLIENT). */
const FIELD_ROLES = [
  'SUPER_ADMIN',
  'PROJECT_MANAGER',
  'SITE_ENGINEER',
  'SUPERVISOR',
  'WORKER',
] as const;

/** Roles allowed to *view* updates (CLIENT included; service filters rows). */
const VIEWER_ROLES = [
  'SUPER_ADMIN',
  'PROJECT_MANAGER',
  'SITE_ENGINEER',
  'SUPERVISOR',
  'ACCOUNTANT',
  'WORKER',
  'CLIENT',
] as const;

@Controller()
export class UpdatesController {
  constructor(private readonly updatesService: UpdatesService) {}

  /** GET /api/v1/phases/:phaseId/updates */
  @Get('phases/:phaseId/updates')
  @Roles(...VIEWER_ROLES)
  findAll(
    @CurrentUser() user: JwtPayload,
    @Param('phaseId', ParseUUIDPipe) phaseId: string,
    @Query() query: ListUpdatesQueryDto,
  ) {
    return this.updatesService.findAll(user, phaseId, query);
  }

  /** GET /api/v1/updates/:id */
  @Get('updates/:id')
  @Roles(...VIEWER_ROLES)
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.updatesService.findOne(user, id);
  }

  /**
   * POST /api/v1/phases/:phaseId/updates — Create Draft
   * CLIENT cannot create. Service further verifies project assignment.
   */
  @Post('phases/:phaseId/updates')
  @Roles(...FIELD_ROLES)
  create(
    @CurrentUser() user: JwtPayload,
    @Param('phaseId', ParseUUIDPipe) phaseId: string,
    @Body() dto: CreateUpdateDto,
    @Req() req: Request,
  ) {
    return this.updatesService.create(user, phaseId, dto, req);
  }

  /**
   * PATCH /api/v1/updates/:id — Edit Draft or Rejected
   * Service enforces submitter-ownership.
   */
  @Patch('updates/:id')
  @Roles(...FIELD_ROLES)
  editDraft(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditUpdateDto,
    @Req() req: Request,
  ) {
    return this.updatesService.editDraft(user, id, dto, req);
  }

  /**
   * POST /api/v1/updates/:id/submit — DRAFT → PENDING
   * Only the submitter can submit (enforced in service).
   */
  @Post('updates/:id/submit')
  @Roles(...FIELD_ROLES)
  submit(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.updatesService.submit(user, id, req);
  }

  /**
   * POST /api/v1/updates/:id/approve — PENDING → APPROVED
   * Idempotent — requires `Idempotency-Key` header. Reapply with the same
   * key returns the cached result; without idempotency a double-click would
   * increment phase.progress twice.
   */
  @Post('updates/:id/approve')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  approve(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @IdempotencyKey() idempotencyKey: string,
    @Req() req: Request,
  ) {
    return this.updatesService.approve(user, id, idempotencyKey, req);
  }

  /** POST /api/v1/updates/:id/reject — PENDING → REJECTED */
  @Post('updates/:id/reject')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectUpdateDto,
    @Req() req: Request,
  ) {
    return this.updatesService.reject(user, id, dto, req);
  }

  /**
   * POST /api/v1/updates/:id/force-cancel — APPROVED → FORCE_CANCELLED
   * Idempotent + SUPER_ADMIN only. Creates a SUNK_COST payment + reverses
   * progress. Retries must NOT double-reverse, hence Idempotency-Key.
   */
  @Post('updates/:id/force-cancel')
  @Roles('SUPER_ADMIN')
  forceCancel(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ForceCancelDto,
    @IdempotencyKey() idempotencyKey: string,
    @Req() req: Request,
  ) {
    return this.updatesService.forceCancel(user, id, dto, idempotencyKey, req);
  }

  /** PATCH /api/v1/updates/:id/edit-approved — Edit within 24h window */
  @Patch('updates/:id/edit-approved')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  editApproved(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditApprovedDto,
    @Req() req: Request,
  ) {
    return this.updatesService.editApproved(user, id, dto, req);
  }

  /** GET /api/v1/updates/:id/versions — Version history */
  @Get('updates/:id/versions')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT')
  getVersions(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.updatesService.getVersions(user, id);
  }
}
