import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardDocs } from './docs/dashboard.docs.js';
import { DashboardRangeQueryDto, DashboardTrendQueryDto } from './dtos/dashboard-query.dto.js';

// Aggregates of the signed-in account's own data (scope §5.9)
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @DashboardDocs.Summary()
  summary(@Query() query: DashboardRangeQueryDto, @CurrentUser() user: AuthUser) {
    return this.dashboardService.summary(query, user);
  }

  @Get('trends')
  @DashboardDocs.Trend()
  trend(@Query() query: DashboardTrendQueryDto, @CurrentUser() user: AuthUser) {
    return this.dashboardService.trend(query, user);
  }
}
