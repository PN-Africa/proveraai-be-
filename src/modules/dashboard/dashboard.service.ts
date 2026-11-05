import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { DashboardRangeQueryDto, DashboardTrendQueryDto } from './dtos/dashboard-query.dto.js';

const toRange = (query: DashboardRangeQueryDto) => ({
  from: query.from ? new Date(query.from) : undefined,
  to: query.to ? new Date(query.to) : undefined,
});

@Injectable()
export class DashboardService {
  constructor(private readonly transactionsService: TransactionsService) {}

  summary(query: DashboardRangeQueryDto, user: AuthUser) {
    return this.transactionsService.getSummary(toRange(query), user);
  }

  trend(query: DashboardTrendQueryDto, user: AuthUser) {
    return this.transactionsService.getTrend(toRange(query), query.interval ?? 'day', user);
  }
}
