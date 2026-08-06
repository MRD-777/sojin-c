// ============================================
// 📸 Media Module
// ============================================
import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaSecurityService } from './media-security.service';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [AuditModule, ProjectsModule, CompaniesModule],
  controllers: [MediaController],
  providers: [MediaService, MediaSecurityService],
  exports: [MediaService],
})
export class MediaModule {}
