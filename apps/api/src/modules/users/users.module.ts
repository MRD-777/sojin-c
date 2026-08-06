// ============================================
// 👤 Users Module
// ============================================
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditModule } from '../audit/audit.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [AuditModule, CompaniesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
