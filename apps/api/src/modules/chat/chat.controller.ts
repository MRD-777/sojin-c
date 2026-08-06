// ============================================
// 🗨️ Chat Controller
// ============================================
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatRoomDto, SendMessageDto, ListMessagesQueryDto } from './dto';
import { Roles, CurrentUser, JwtPayload } from '../../common/decorators';
import { Request } from 'express';

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** GET /api/v1/projects/:projectId/chat-rooms */
  @Get('projects/:projectId/chat-rooms')
  findRooms(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.chatService.findRooms(user, projectId);
  }

  /** POST /api/v1/projects/:projectId/chat-rooms */
  @Post('projects/:projectId/chat-rooms')
  @Roles('SUPER_ADMIN', 'PROJECT_MANAGER')
  createRoom(
    @CurrentUser() user: JwtPayload,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateChatRoomDto,
    @Req() req: Request,
  ) {
    return this.chatService.createRoom(user, projectId, dto, req);
  }

  /** GET /api/v1/chat-rooms/:roomId/messages */
  @Get('chat-rooms/:roomId/messages')
  getMessages(
    @CurrentUser() user: JwtPayload,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.chatService.getMessages(user, roomId, query);
  }

  /** POST /api/v1/chat-rooms/:roomId/messages */
  @Post('chat-rooms/:roomId/messages')
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    return this.chatService.sendMessage(user, roomId, dto, req);
  }

  /** POST /api/v1/chat-rooms/:roomId/read */
  @Post('chat-rooms/:roomId/read')
  markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    return this.chatService.markAsRead(user, roomId);
  }
}
