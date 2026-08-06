// ============================================
// 📸 Media Controller
//
// Authorization stack: JwtAuthGuard (global) → @Roles → service-level ownership.
// All mutations include audit logging inside their transaction.
//
// Flow (P0 hardened):
//   1. POST /media/upload-url       → server issues signed upload URL
//   2. Client PUTs the file to the URL (direct-to-Supabase)
//   3. POST /updates/:uid/media     → server verifies magic bytes + size,
//                                      then registers the Media row
//   4. GET  /media/:id/signed-url   → server returns short-lived read URL
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
  Req,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { CreateMediaDto, CreateUploadUrlDto, DeleteMediaDto } from './dto';
import { CurrentUser, JwtPayload, Roles } from '../../common/decorators';
import { Request } from 'express';

@Controller()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * POST /api/v1/media/upload-url
   * Returns a signed Supabase upload URL bound to a server-chosen path.
   * Body: { type: MediaType }. Bucket and path are NEVER picked by client.
   */
  @Post('media/upload-url')
  @Roles(
    'SUPER_ADMIN',
    'PROJECT_MANAGER',
    'SITE_ENGINEER',
    'SUPERVISOR',
    'WORKER',
  )
  createUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.mediaService.createUploadUrl(user, dto.type);
  }

  /** POST /api/v1/updates/:updateId/media */
  @Post('updates/:updateId/media')
  @Roles(
    'SUPER_ADMIN',
    'PROJECT_MANAGER',
    'SITE_ENGINEER',
    'SUPERVISOR',
    'WORKER',
  )
  addToUpdate(
    @CurrentUser() user: JwtPayload,
    @Param('updateId', ParseUUIDPipe) updateId: string,
    @Body() dto: CreateMediaDto,
    @Req() req: Request,
  ) {
    return this.mediaService.addToUpdate(user, updateId, dto, req);
  }

  /** GET /api/v1/updates/:updateId/media */
  @Get('updates/:updateId/media')
  @Roles(
    'SUPER_ADMIN',
    'PROJECT_MANAGER',
    'SITE_ENGINEER',
    'SUPERVISOR',
    'ACCOUNTANT',
    'WORKER',
    'CLIENT',
  )
  findByUpdate(
    @CurrentUser() user: JwtPayload,
    @Param('updateId', ParseUUIDPipe) updateId: string,
  ) {
    return this.mediaService.findByUpdate(user, updateId);
  }

  /**
   * GET /api/v1/media/:id/signed-url
   * Short-lived signed URL for downloading the file. TTL is policy-driven
   * (15min for documents, 1h for media). Soft-deleted records return 404.
   */
  @Get('media/:id/signed-url')
  @Roles(
    'SUPER_ADMIN',
    'PROJECT_MANAGER',
    'SITE_ENGINEER',
    'SUPERVISOR',
    'ACCOUNTANT',
    'WORKER',
    'CLIENT',
  )
  getSignedUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mediaService.getSignedReadUrl(user, id);
  }

  /**
   * DELETE /api/v1/media/:id
   * Soft-delete with mandatory reason. Storage file is preserved.
   * The submitter or admins only — enforced in the service after ownership check.
   */
  @Delete('media/:id')
  @Roles(
    'SUPER_ADMIN',
    'PROJECT_MANAGER',
    'SITE_ENGINEER',
    'SUPERVISOR',
    'WORKER',
  )
  @HttpCode(200)
  softDelete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteMediaDto,
    @Req() req: Request,
  ) {
    return this.mediaService.softDelete(user, id, dto, req);
  }
}
