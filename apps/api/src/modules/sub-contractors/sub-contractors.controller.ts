// ============================================
// 🏗️ Sub-Contractors Controller
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
import { SubContractorsService } from './sub-contractors.service';
import {
  CreateSubContractorDto,
  UpdateSubContractorDto,
  AssignToPhaseDto,
  UpdatePhaseAssignmentDto,
} from './dto';
import { Roles, CurrentUser, JwtPayload } from '../../common/decorators';
import { Request } from 'express';

@Controller()
export class SubContractorsController {
  constructor(private readonly subContractorsService: SubContractorsService) {}

  /** GET /api/v1/sub-contractors — List company sub-contractors */
  @Get('sub-contractors')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.subContractorsService.findAll(user);
  }

  /** GET /api/v1/sub-contractors/:id — Get single */
  @Get('sub-contractors/:id')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subContractorsService.findOne(user, id);
  }

  /** POST /api/v1/sub-contractors — Create company sub-contractor */
  @Post('sub-contractors')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSubContractorDto,
    @Req() req: Request,
  ) {
    return this.subContractorsService.create(user, dto, req);
  }

  /** PATCH /api/v1/sub-contractors/:id — Update */
  @Patch('sub-contractors/:id')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubContractorDto,
    @Req() req: Request,
  ) {
    return this.subContractorsService.update(user, id, dto, req);
  }

  /** GET /api/v1/phases/:phaseId/sub-contractors — List phase assignments */
  @Get('phases/:phaseId/sub-contractors')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT')
  findByPhase(
    @CurrentUser() user: JwtPayload,
    @Param('phaseId', ParseUUIDPipe) phaseId: string,
  ) {
    return this.subContractorsService.findByPhase(user, phaseId);
  }

  /** POST /api/v1/phases/:phaseId/sub-contractors — Assign to phase */
  @Post('phases/:phaseId/sub-contractors')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  assignToPhase(
    @CurrentUser() user: JwtPayload,
    @Param('phaseId', ParseUUIDPipe) phaseId: string,
    @Body() dto: AssignToPhaseDto,
    @Req() req: Request,
  ) {
    return this.subContractorsService.assignToPhase(user, phaseId, dto, req);
  }

  /** PATCH /api/v1/phase-assignments/:id — Update phase assignment */
  @Patch('phase-assignments/:id')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  updateAssignment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePhaseAssignmentDto,
    @Req() req: Request,
  ) {
    return this.subContractorsService.updatePhaseAssignment(user, id, dto, req);
  }

  /** DELETE /api/v1/sub-contractors/:id — Soft delete */
  @Delete('sub-contractors/:id')
  @Roles('SUPER_ADMIN')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.subContractorsService.softDelete(user, id, req);
  }
}
