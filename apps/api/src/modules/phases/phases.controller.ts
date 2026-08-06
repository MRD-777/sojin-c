// ============================================
// 🔧 Phases Controller
// ============================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PhasesService } from './phases.service';
import {
  CreatePhaseDto,
  UpdatePhaseDto,
  OverrideProgressDto,
  ReorderPhaseDto,
  DeletePhaseDto,
} from './dto';
import { Roles, CurrentUser, JwtPayload } from '../../common/decorators';
import { Request } from 'express';

@Controller()
export class PhasesController {
  constructor(private readonly phasesService: PhasesService) {}

  /** GET /api/v1/projects/:projectId/phases */
  @Get('projects/:projectId/phases')
  findAll(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.phasesService.findAll(user, projectId);
  }

  /** GET /api/v1/phases/:id */
  @Get('phases/:id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.phasesService.findOne(user, id);
  }

  /** POST /api/v1/projects/:projectId/phases */
  @Post('projects/:projectId/phases')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreatePhaseDto,
    @Req() req: Request,
  ) {
    return this.phasesService.create(user, projectId, dto, req);
  }

  /** PATCH /api/v1/phases/:id */
  @Patch('phases/:id')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePhaseDto,
    @Req() req: Request,
  ) {
    return this.phasesService.update(user, id, dto, req);
  }

  /** PATCH /api/v1/phases/:id/progress */
  @Patch('phases/:id/progress')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  overrideProgress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideProgressDto,
    @Req() req: Request,
  ) {
    return this.phasesService.overrideProgress(user, id, dto, req);
  }

  /** PATCH /api/v1/phases/:id/reorder */
  @Patch('phases/:id/reorder')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  reorder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderPhaseDto,
    @Req() req: Request,
  ) {
    return this.phasesService.reorder(user, id, dto, req);
  }

  /** DELETE /api/v1/phases/:id — soft delete, reason mandatory */
  @Delete('phases/:id')
  @Roles('SUPER_ADMIN')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeletePhaseDto,
    @Req() req: Request,
  ) {
    return this.phasesService.softDelete(user, id, dto, req);
  }
}
