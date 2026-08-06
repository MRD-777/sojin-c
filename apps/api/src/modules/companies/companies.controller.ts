// ============================================
// 🏢 Companies Controller
// ============================================
import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto, UpdateCompanySettingsDto } from './dto';
import { Roles, CurrentUser, JwtPayload } from '../../common/decorators';
import { Request } from 'express';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /**
   * GET /api/v1/companies/me
   * Any authenticated user can view their company info.
   */
  @Get('me')
  getMyCompany(@CurrentUser() user: JwtPayload) {
    return this.companiesService.getMyCompany(user.companyId);
  }

  /**
   * PATCH /api/v1/companies/me
   * Only SUPER_ADMIN can update company details.
   */
  @Patch('me')
  @Roles('SUPER_ADMIN')
  updateCompany(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCompanyDto,
    @Req() req: Request,
  ) {
    return this.companiesService.updateCompany(user, dto, req);
  }

  /**
   * PATCH /api/v1/companies/settings
   * Only SUPER_ADMIN can update company settings.
   */
  @Patch('settings')
  @Roles('SUPER_ADMIN')
  updateSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCompanySettingsDto,
    @Req() req: Request,
  ) {
    return this.companiesService.updateSettings(user, dto, req);
  }

  /**
   * GET /api/v1/companies/storage
   * Only SUPER_ADMIN can view storage metrics.
   */
  @Get('storage')
  @Roles('SUPER_ADMIN')
  getStorageUsage(@CurrentUser() user: JwtPayload) {
    return this.companiesService.getStorageUsage(user.companyId);
  }
}
