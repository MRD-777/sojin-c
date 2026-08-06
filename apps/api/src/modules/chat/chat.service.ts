// ============================================
// 🗨️ Chat Service — REST-based (WebSocket in Phase 3)
// ============================================
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateChatRoomDto, SendMessageDto, ListMessagesQueryDto } from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, ChatRoomType, ChatMessageType, Prisma } from '@prisma/client';
import { Request } from 'express';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly projectsService: ProjectsService,
  ) {}

  // ─── List Chat Rooms for Project ───────────
  async findRooms(user: JwtPayload, projectId: string) {
    await this.projectsService.ensureProjectAccess(user, projectId);

    // Admin/PM see all rooms; others see only rooms they participate in
    const isAdmin = ['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role);

    // Defense-in-depth: even though ensureProjectAccess() above validated
    // the tenant + soft-delete, the chatRoom query itself re-asserts the
    // project belongs to the caller's company. If a future refactor weakens
    // the upstream gate (or a bug introduces a stale projectId), the chat
    // rooms remain isolated at the DB query level. (CHAT-FOLLOWUP-001)
    const projectGuard = {
      companyId: user.companyId,
      deletedAt: null,
    } satisfies Prisma.ProjectWhereInput;

    if (isAdmin) {
      return this.prisma.chatRoom.findMany({
        where: { projectId, project: projectGuard },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          createdAt: true,
          _count: { select: { messages: true, participants: true } },
        },
      });
    }

    // Non-admin: only rooms they're a participant of
    return this.prisma.chatRoom.findMany({
      where: {
        projectId,
        project: projectGuard,
        participants: { some: { userId: user.userId } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        _count: { select: { messages: true, participants: true } },
      },
    });
  }

  // ─── Create Chat Room ─────────────────────
  async createRoom(
    user: JwtPayload,
    projectId: string,
    dto: CreateChatRoomDto,
    req: Request,
  ) {
    await this.projectsService.ensureProjectAccess(user, projectId);

    const room = await this.prisma.chatRoom.create({
      data: {
        projectId,
        createdBy: user.userId,
        name: dto.name,
        type: (dto.type as ChatRoomType) ?? ChatRoomType.GROUP,
      },
    });

    // Add participants
    const participantIds = dto.participantIds ?? [];
    if (!participantIds.includes(user.userId)) {
      participantIds.push(user.userId); // Creator is always a participant
    }

    if (participantIds.length > 0) {
      await this.prisma.chatParticipant.createMany({
        data: participantIds.map((userId) => ({
          roomId: room.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    await this.auditLog.log({
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'chat_room',
      entityId: room.id,
      action: AuditAction.CREATE,
      newValues: { name: dto.name, projectId, participantCount: participantIds.length },
      req,
    });

    return room;
  }

  // ─── Send Message ──────────────────────────
  async sendMessage(
    user: JwtPayload,
    roomId: string,
    dto: SendMessageDto,
    req: Request,
  ) {
    const room = await this.getRoomWithAccess(user, roomId);

    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId: user.userId,
        content: dto.content,
        type: (dto.type as ChatMessageType) ?? ChatMessageType.TEXT,
        attachmentUrl: dto.attachmentUrl,
      },
      select: {
        id: true,
        content: true,
        type: true,
        attachmentUrl: true,
        createdAt: true,
        sender: { select: { id: true, name: true, role: true, avatar: true } },
      },
    });

    return message;
  }

  // ─── Get Messages (paginated) ──────────────
  async getMessages(
    user: JwtPayload,
    roomId: string,
    query: ListMessagesQueryDto,
  ) {
    const { page = 1, limit = 50, sortOrder = 'desc' } = query;

    await this.getRoomWithAccess(user, roomId);

    const where = { roomId, deletedAt: null };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.chatMessage.findMany({
        where,
        select: {
          id: true,
          content: true,
          type: true,
          attachmentUrl: true,
          isRead: true,
          createdAt: true,
          sender: { select: { id: true, name: true, role: true, avatar: true } },
        },
        orderBy: { createdAt: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.chatMessage.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Mark Messages as Read ─────────────────
  async markAsRead(user: JwtPayload, roomId: string) {
    await this.getRoomWithAccess(user, roomId);

    // Update participant's lastReadAt
    await this.prisma.chatParticipant.updateMany({
      where: { roomId, userId: user.userId },
      data: { lastReadAt: new Date() },
    });

    // Mark messages as read
    await this.prisma.chatMessage.updateMany({
      where: {
        roomId,
        senderId: { not: user.userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return { message: 'تم تحديث حالة القراءة' };
  }

  // ─── Helpers ───────────────────────────────
  private async getRoomWithAccess(user: JwtPayload, roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { project: { select: { companyId: true, id: true } } },
    });

    if (!room) throw new NotFoundException('الغرفة غير موجودة');
    if (room.project.companyId !== user.companyId) {
      throw new NotFoundException('الغرفة غير موجودة');
    }

    await this.projectsService.ensureProjectAccess(user, room.project.id);
    return room;
  }
}
