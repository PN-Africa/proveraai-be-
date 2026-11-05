import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

const BAD_RANGE = ApiResponse({ status: 400, description: 'Invalid date, or from is after to' });

export class DashboardDocs {
  static Summary() {
    return applyDecorators(
      ApiOperation({
        summary: 'Dashboard totals for your data',
        description:
          'Transactions (total, scored, flagged, flaggedPercent of scored), count per risk level, ' +
          'review progress (open, closed, cleared, escalated) and the 10 rules that fired most. ' +
          'Optional from/to filter on when transactions occurred; all time without them.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'The totals' }),
      BAD_RANGE,
    );
  }

  static Trend() {
    return applyDecorators(
      ApiOperation({
        summary: 'Your transactions and flags over time',
        description:
          'One point per day or week (weeks start Monday) in Nigerian time, including empty ones. ' +
          'Defaults to the last 30 days or 12 weeks. At most 400 points.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: '{ from, to, interval, timeZone, points: [{ period, total, flagged, high }] }' }),
      ApiResponse({ status: 400, description: 'Invalid date, from after to, or too many points' }),
    );
  }
}
