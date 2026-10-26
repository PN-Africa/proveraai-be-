import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';
import { DashboardDocs } from './docs/dashboard.docs.js';
import { DashboardRangeQueryDto, DashboardTrendQueryDto } from './dtos/dashboard-query.dto.js';

// Aggregates only, for every signed-in account (scope §5.9)
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @DashboardDocs.Summary()
  summary(@Query() query: DashboardRangeQueryDto) {
    return this.dashboardService.summary(query);
  }

  @Get('trends')
  @DashboardDocs.Trend()
  trend(@Query() query: DashboardTrendQueryDto) {
    return this.dashboardService.trend(query);
  }
}
