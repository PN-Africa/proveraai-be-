import { BadRequestException } from '@nestjs/common';
import { RiskIndicatorModelAction } from '../model-actions/risk-indicator-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { TransactionStatsService } from './transaction-stats.service.js';

const setup = ({
  totals = undefined as Record<string, string> | undefined,
  periods = [] as { period: string; total: string; flagged: string; high: string }[],
} = {}) => {
  const transactionModelAction = {
    summarize: vi.fn(async () => totals),
    countByPeriod: vi.fn(async () => periods),
  };
  const riskIndicatorModelAction = {
    countByRule: vi.fn(async () => [
      { ruleKey: 'high-amount-ngn', ruleName: 'High-value transaction (NGN)', hits: '4' },
    ]),
  };
  const service = new TransactionStatsService(
    transactionModelAction as unknown as TransactionModelAction,
    riskIndicatorModelAction as unknown as RiskIndicatorModelAction,
  );
  return { service, transactionModelAction };
};

describe('TransactionStatsService', () => {
  describe('summary', () => {
    it('turns raw counts into numbers and percentages of scored transactions', async () => {
      const { service, transactionModelAction } = setup({
        totals: {
          total: '21', scored: '20', flagged: '3', low: '15', medium: '2', high: '3',
          open: '2', closed: '1', cleared: '0', escalated: '1',
        },
      });
      expect(await service.summary('owner-1', {})).toEqual({
        from: null,
        to: null,
        transactions: { total: 21, scored: 20, flagged: 3, flaggedPercent: 15 },
        riskLevels: { LOW: 15, MEDIUM: 2, HIGH: 3 },
        reviews: { open: 2, closed: 1, cleared: 0, escalated: 1 },
        topIndicators: [{ ruleName: 'High-value transaction (NGN)', count: 4, percentOfScored: 20 }],
      });
      expect(transactionModelAction.summarize).toHaveBeenCalledWith('owner-1', {});
    });

    it('returns zeros with no data', async () => {
      const result = await setup().service.summary('owner-1', {});
      expect(result.transactions).toEqual({ total: 0, scored: 0, flagged: 0, flaggedPercent: 0 });
    });

    it('refuses a range that ends before it starts', async () => {
      await expect(
        setup().service.summary('owner-1', { from: new Date('2026-10-02'), to: new Date('2026-10-01') }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('trend', () => {
    it('fills every day in the range, counting in Nigerian time', async () => {
      const { service, transactionModelAction } = setup({
        periods: [{ period: '2026-10-02', total: '5', flagged: '1', high: '1' }],
      });
      const result = await service.trend(
        'owner-1',
        // 23:30 UTC on the 3rd is already the 4th in Lagos
        { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-03T23:30:00Z') },
        'day',
      );
      expect(result.points).toEqual([
        { period: '2026-10-01', total: 0, flagged: 0, high: 0 },
        { period: '2026-10-02', total: 5, flagged: 1, high: 1 },
        { period: '2026-10-03', total: 0, flagged: 0, high: 0 },
        { period: '2026-10-04', total: 0, flagged: 0, high: 0 },
      ]);
      expect(transactionModelAction.countByPeriod).toHaveBeenCalledWith('owner-1', 'day', 'Africa/Lagos', {
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-03T23:30:00Z'),
      });
    });

    it('defaults to the last 30 days, starting at local midnight', async () => {
      const result = await setup().service.trend('owner-1', { to: new Date('2026-10-27T10:00:00Z') }, 'day');
      expect(result.points).toHaveLength(30);
      expect(result.points[0].period).toBe('2026-09-28');
      expect(result.points[29].period).toBe('2026-10-27');
      expect(result.from).toEqual(new Date('2026-09-27T23:00:00Z'));
    });

    it('groups by weeks starting on Monday', async () => {
      const result = await setup().service.trend('owner-1', { to: new Date('2026-10-27T10:00:00Z') }, 'week');
      expect(result.points).toHaveLength(12);
      expect(result.points[0].period).toBe('2026-08-10');
      expect(result.points[11].period).toBe('2026-10-26');
    });

    it('refuses more than 400 points', async () => {
      await expect(
        setup().service.trend('owner-1', { from: new Date('2024-01-01'), to: new Date('2026-01-01') }, 'day'),
      ).rejects.toThrow('The range is too long for interval=day. Use a shorter range or interval=week');
    });
  });
});
