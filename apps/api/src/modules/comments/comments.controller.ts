// ============================================
// 💬 Comments Controller
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
import { CommentsService } from './comments.service';
import { CreateCommentDto, EditCommentDto, ResolveCommentDto } from './dto';
import { Roles, CurrentUser, JwtPayload } from '../../common/decorators';
import { Request } from 'express';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /** GET /api/v1/updates/:updateId/comments */
  @Get('updates/:updateId/comments')
  findByUpdate(
    @CurrentUser() user: JwtPayload,
    @Param('updateId', ParseUUIDPipe) updateId: string,
  ) {
    return this.commentsService.findByUpdate(user, updateId);
  }

  /** POST /api/v1/updates/:updateId/comments */
  @Post('updates/:updateId/comments')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('updateId', ParseUUIDPipe) updateId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ) {
    return this.commentsService.create(user, updateId, dto, req);
  }

  /** PATCH /api/v1/comments/:id */
  @Patch('comments/:id')
  edit(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditCommentDto,
    @Req() req: Request,
  ) {
    return this.commentsService.edit(user, id, dto, req);
  }

  /** PATCH /api/v1/comments/:id/status */
  @Patch('comments/:id/status')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER')
  changeStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveCommentDto,
    @Req() req: Request,
  ) {
    return this.commentsService.changeStatus(user, id, dto, req);
  }

  /** DELETE /api/v1/comments/:id */
  @Delete('comments/:id')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.commentsService.softDelete(user, id, req);
  }
}
