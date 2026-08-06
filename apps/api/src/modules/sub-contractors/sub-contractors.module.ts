// ============================================
// 🏗️ Sub-Contractors Module
// ============================================
import { Module } from '@nestjs/common';
import { SubContractorsController } from './sub-contractors.controller';
import { SubContractorsService } from './sub-contractors.service';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [AuditModule, ProjectsModule],
  controllers: [SubContractorsController],
  providers: [SubContractorsService],
  exports: [SubContractorsService],
})
export class SubContractorsModule {}
