// ============================================
// 🏢 Companies Module
// ============================================
import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { TierLimitsService } from './tier-limits.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, TierLimitsService],
  // Export TierLimitsService so other modules (users, projects, media)
  // can enforce plan limits without re-implementing them.
  exports: [CompaniesService, TierLimitsService],
})
export class CompaniesModule {}
