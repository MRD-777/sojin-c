// ============================================
// 📋 Projects Module
// ============================================
import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { AuditModule } from '../audit/audit.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [AuditModule, CompaniesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
