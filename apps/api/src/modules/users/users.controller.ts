// ============================================
// 👤 Users Controller — Full RBAC
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
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateMyProfileDto,
  ChangeRoleDto,
  UpdatePermissionsDto,
  ListUsersQueryDto,
  DeleteUserDto,
} from './dto';
import { Roles, CurrentUser, JwtPayload } from '../../common/decorators';
import { Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/users
   * SUPER_ADMIN sees all. PROJECT_MANAGER sees all.
   */
  @Get()
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.usersService.findAll(user.companyId, query);
  }

  /**
   * GET /api/v1/users/me
   * Any authenticated user can view their own profile.
   */
  @Get('me')
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMyProfile(user);
  }

  /**
   * PATCH /api/v1/users/me
   * Any authenticated user can update their own profile.
   * `req` threads through for the audit log (A5).
   */
  @Patch('me')
  updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateMyProfileDto,
    @Req() req: Request,
  ) {
    return this.usersService.updateMyProfile(user, dto, req);
  }

  /**
   * GET /api/v1/users/:id
   * SUPER_ADMIN and PROJECT_MANAGER can view any user.
   */
  @Get(':id')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.findOne(user.companyId, id);
  }

  /**
   * POST /api/v1/users
   * Only SUPER_ADMIN can invite/create users.
   */
  @Post()
  @Roles('SUPER_ADMIN')
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateUserDto,
    @Req() req: Request,
  ) {
    return this.usersService.create(user, dto, req);
  }

  /**
   * PATCH /api/v1/users/:id
   * Only SUPER_ADMIN can update other users.
   */
  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.usersService.update(user, id, dto, req);
  }

  /**
   * PATCH /api/v1/users/:id/role
   * Only SUPER_ADMIN can change roles.
   */
  @Patch(':id/role')
  @Roles('SUPER_ADMIN')
  changeRole(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
    @Req() req: Request,
  ) {
    return this.usersService.changeRole(user, id, dto, req);
  }

  /**
   * PATCH /api/v1/users/:id/permissions
   * Only SUPER_ADMIN can modify custom permissions.
   */
  @Patch(':id/permissions')
  @Roles('SUPER_ADMIN')
  updatePermissions(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionsDto,
    @Req() req: Request,
  ) {
    return this.usersService.updatePermissions(user, id, dto, req);
  }

  /**
   * POST /api/v1/users/:id/deactivate
   * Only SUPER_ADMIN can deactivate accounts.
   */
  @Post(':id/deactivate')
  @Roles('SUPER_ADMIN')
  deactivate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.usersService.deactivate(user, id, req);
  }

  /**
   * POST /api/v1/users/:id/activate
   * Only SUPER_ADMIN can reactivate accounts.
   */
  @Post(':id/activate')
  @Roles('SUPER_ADMIN')
  activate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.usersService.activate(user, id, req);
  }

  /**
   * DELETE /api/v1/users/:id
   * Only SUPER_ADMIN can soft-delete users. Reason is mandatory.
   */
  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteUserDto,
    @Req() req: Request,
  ) {
    return this.usersService.softDelete(user, id, dto.reason, req);
  }
}
