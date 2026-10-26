import { Injectable } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service.js';
import { DashboardRangeQueryDto, DashboardTrendQueryDto } from './dtos/dashboard-query.dto.js';

const toRange = (query: DashboardRangeQueryDto) => ({
  from: query.from ? new Date(query.from) : undefined,
  to: query.to ? new Date(query.to) : undefined,
});

@Injectable()
export class DashboardService {
  constructor(private readonly transactionsService: TransactionsService) {}

  summary(query: DashboardRangeQueryDto) {
    return this.transactionsService.getSummary(toRange(query));
  }

  trend(query: DashboardTrendQueryDto) {
    return this.transactionsService.getTrend(toRange(query), query.interval ?? 'day');
  }
}
