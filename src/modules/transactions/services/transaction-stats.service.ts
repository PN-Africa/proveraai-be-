import { BadRequestException, Injectable } from '@nestjs/common';
import { RiskIndicatorModelAction } from '../model-actions/risk-indicator-model-action.js';
import {
  type OccurredRange,
  TransactionModelAction,
} from '../model-actions/transaction-model-action.js';

export type TrendInterval = 'day' | 'week';

// Days and weeks are counted in Nigerian time (WAT, UTC+1 all year)
const TIME_ZONE = 'Africa/Lagos';
const UTC_OFFSET_MS = 60 * 60_000;
const DAY_MS = 86_400_000;
const DEFAULT_PERIODS: Record<TrendInterval, number> = { day: 30, week: 12 };
const MAX_PERIODS = 400;
const TOP_INDICATORS = 10;

// First local day of the period holding this instant. The result's UTC
// date fields are that local date; subtract UTC_OFFSET_MS for the instant.
const periodOf = (instant: Date, interval: TrendInterval): Date => {
  const local = new Date(instant.getTime() + UTC_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  // Weeks start on Monday, like Postgres date_trunc('week')
  if (interval === 'week') local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local;
};

const count = (value: string | undefined) => Number(value ?? 0);
const percent = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

const assertOrdered = ({ from, to }: OccurredRange) => {
  if (from && to && from > to) throw new BadRequestException('from must be before to');
};

// Aggregates for the dashboard. Ranges are on when transactions occurred.
@Injectable()
export class TransactionStatsService {
  constructor(
    private readonly transactionModelAction: TransactionModelAction,
    private readonly riskIndicatorModelAction: RiskIndicatorModelAction,
  ) {}

  async summary(range: OccurredRange) {
    assertOrdered(range);
    const [totals, rules] = await Promise.all([
      this.transactionModelAction.summarize(range),
      this.riskIndicatorModelAction.countByRule(range, TOP_INDICATORS),
    ]);
    const scored = count(totals?.scored);
    const flagged = count(totals?.flagged);
    return {
      from: range.from ?? null,
      to: range.to ?? null,
      transactions: {
        total: count(totals?.total),
        scored,
        flagged,
        flaggedPercent: percent(flagged, scored),
      },
      riskLevels: {
        LOW: count(totals?.low),
        MEDIUM: count(totals?.medium),
        HIGH: count(totals?.high),
      },
      reviews: {
        open: count(totals?.open),
        inReview: count(totals?.inReview),
        closed: count(totals?.closed),
        cleared: count(totals?.cleared),
        escalated: count(totals?.escalated),
      },
      // Names and counts only, no weights or thresholds (TR-11)
      topIndicators: rules.map((r) => ({
        ruleName: r.ruleName,
        count: count(r.hits),
        percentOfScored: percent(count(r.hits), scored),
      })),
    };
  }

  // One entry per day or week in the range, including empty ones, so the
  // chart has no gaps. Defaults to the last 30 days or 12 weeks.
  async trend(range: OccurredRange, interval: TrendInterval) {
    const to = range.to ?? new Date();
    const step = interval === 'day' ? 1 : 7;
    const firstPeriod = periodOf(to, interval).getTime() - (DEFAULT_PERIODS[interval] - 1) * step * DAY_MS;
    const from = range.from ?? new Date(firstPeriod - UTC_OFFSET_MS);
    assertOrdered({ from, to });

    const periods: string[] = [];
    const last = periodOf(to, interval);
    for (const day = periodOf(from, interval); day <= last; day.setUTCDate(day.getUTCDate() + step)) {
      if (periods.length === MAX_PERIODS) {
        throw new BadRequestException(
          `The range is too long for interval=${interval}. Use a shorter range${interval === 'day' ? ' or interval=week' : ''}`,
        );
      }
      periods.push(day.toISOString().slice(0, 10));
    }

    const rows = await this.transactionModelAction.countByPeriod(interval, TIME_ZONE, { from, to });
    const byPeriod = new Map(rows.map((r) => [r.period, r]));
    return {
      from,
      to,
      interval,
      timeZone: TIME_ZONE,
      points: periods.map((period) => {
        const row = byPeriod.get(period);
        return {
          period,
          total: count(row?.total),
          flagged: count(row?.flagged),
          high: count(row?.high),
        };
      }),
    };
  }
}
