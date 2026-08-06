// ============================================
// 💵 Finance Module — S7
//
// Owns: project financial settings, the computed financial summary, and the
// BOQ tree. `payments` stays responsible for cash movements only.
//
// AuditModule    → logInTransaction on settings PATCH + BOQ writes/deletes.
// ProjectsModule → ensureProjectAccess (Layer 3 authorization).
//
// ⚠️ Not registered in AppModule yet — that happens in Stage 7 of 00-plan.md,
// after the three services carry real logic.
// ============================================
import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinancialSettingsService } from './financial-settings.service';
import { FinancialSummaryService } from './financial-summary.service';
import { BOQService } from './boq.service';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [AuditModule, ProjectsModule],
  controllers: [FinanceController],
  providers: [
    FinancialSettingsService,
    FinancialSummaryService,
    BOQService,
  ],
  exports: [FinancialSettingsService, FinancialSummaryService, BOQService],
})
export class FinanceModule {}
