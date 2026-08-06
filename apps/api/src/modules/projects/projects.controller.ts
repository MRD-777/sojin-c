// ============================================
// 📋 Projects Controller — Full RBAC
// ============================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ChangeProjectStatusDto,
  AssignMemberDto,
  RemoveMemberDto,
  DeleteProjectDto,
  ListProjectsQueryDto,
} from './dto';
import { Roles, CurrentUser, JwtPayload } from '../../common/decorators';
import { Request } from 'express';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * GET /api/v1/projects
   * All roles — visibility filtered by role in service.
   */
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListProjectsQueryDto,
  ) {
    return this.projectsService.findAll(user, query);
  }

  /**
   * GET /api/v1/projects/:id
   * All roles — access checked by role in service.
   */
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.findOne(user, id);
  }

  /**
   * POST /api/v1/projects
   * SUPER_ADMIN and PROJECT_MANAGER only.
   */
  @Post()
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProjectDto,
    @Req() req: Request,
  ) {
    return this.projectsService.create(user, dto, req);
  }

  /**
   * PATCH /api/v1/projects/:id
   */
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: Request,
  ) {
    return this.projectsService.update(user, id, dto, req);
  }

  /**
   * PATCH /api/v1/projects/:id/status
   */
  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  changeStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeProjectStatusDto,
    @Req() req: Request,
  ) {
    return this.projectsService.changeStatus(user, id, dto, req);
  }

  /**
   * DELETE /api/v1/projects/:id
   * Soft-delete with mandatory reason (skill 07).
   */
  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteProjectDto,
    @Req() req: Request,
  ) {
    return this.projectsService.softDelete(user, id, dto.reason, req);
  }

  /**
   * POST /api/v1/projects/:id/assignments
   */
  @Post(':id/assignments')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  assignMember(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignMemberDto,
    @Req() req: Request,
  ) {
    return this.projectsService.assignMember(user, id, dto, req);
  }

  /**
   * DELETE /api/v1/projects/:id/assignments/:userId
   * Soft-removes a member assignment. Reason is mandatory.
   */
  @Delete(':id/assignments/:userId')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: RemoveMemberDto,
    @Req() req: Request,
  ) {
    return this.projectsService.removeMember(user, id, userId, dto.reason, req);
  }
}
