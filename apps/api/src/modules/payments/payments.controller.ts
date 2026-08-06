// ============================================
// 💰 Payments Controller
//
// Authorization layers (enforced top-to-bottom):
//   1. JwtAuthGuard      — global, requires valid Supabase JWT
//   2. RolesGuard        — @Roles() per endpoint
//   3. Service-level     — ownership check (companyId + project access)
// ============================================
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentDto,
  DeletePaymentDto,
  ListPaymentsQueryDto,
} from './dto';
import {
  CurrentUser,
  IdempotencyKey,
  JwtPayload,
  Roles,
} from '../../common/decorators';
import { Request } from 'express';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** GET /api/v1/projects/:projectId/payments */
  @Get('projects/:projectId/payments')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT')
  findAll(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.paymentsService.findAll(user, projectId, query);
  }

  /** GET /api/v1/projects/:projectId/payments/summary */
  @Get('projects/:projectId/payments/summary')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT', 'CLIENT')
  getSummary(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.paymentsService.getSummary(user, projectId);
  }

  /** GET /api/v1/payments/:id */
  @Get('payments/:id')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT', 'CLIENT')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.findOne(user, id);
  }

  /**
   * POST /api/v1/projects/:projectId/payments
   * Idempotent — requires `Idempotency-Key` header (16-64 chars, [A-Za-z0-9_-]).
   * Retry with the same key + same body returns the original response.
   */
  @Post('projects/:projectId/payments')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreatePaymentDto,
    @IdempotencyKey() idempotencyKey: string,
    @Req() req: Request,
  ) {
    return this.paymentsService.create(user, projectId, dto, idempotencyKey, req);
  }

  /**
   * DELETE /api/v1/payments/:id
   * Soft-delete (sets deletedAt + deletedBy + deletionReason).
   * Hard delete is forbidden for financial records.
   *
   * SUPER_ADMIN only — deletion of payments is a high-stakes operation.
   * The body is required (reason ≥ 20 chars) — not optional.
   */
  @Delete('payments/:id')
  @Roles('SUPER_ADMIN')
  @HttpCode(200)
  softDelete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeletePaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.softDelete(user, id, dto, req);
  }
}
