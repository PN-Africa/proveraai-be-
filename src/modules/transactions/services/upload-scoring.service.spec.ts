import type { DataSource, EntityManager } from 'typeorm';
import { DetectionService } from '../../detection/detection.service.js';
import { RiskLevel } from '../../detection/enums/risk-level.enum.js';
import { RiskIndicatorModelAction } from '../model-actions/risk-indicator-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { TransactionModel } from '../models/transaction.model.js';
import { UploadScoringService } from './upload-scoring.service.js';

const tx = (id: string, occurredAt: string) =>
  ({ id, transactionId: id, amount: '100.00', occurredAt: new Date(occurredAt), customerId: 'CUST-1' }) as TransactionModel;

const setup = () => {
  const manager = {} as EntityManager;
  const dataSource = { transaction: vi.fn(async (work: (m: EntityManager) => Promise<void>) => work(manager)) };
  const detectionService = {
    scoreBatch: vi.fn(async (targets: { id: string }[]) =>
      targets.map((t, i) => ({
        id: t.id,
        indicators: i === 0 ? [{ ruleId: 'r', ruleKey: 'k', ruleName: 'n', weight: 80, reason: 'x', details: {} }] : [],
        riskScore: i === 0 ? 80 : 0,
        riskLevel: i === 0 ? RiskLevel.HIGH : RiskLevel.LOW,
        flagged: i === 0,
      })),
    ),
  };
  const transactionModelAction = {
    findCustomerHistory: vi.fn(async () => []),
    saveRiskResults: vi.fn(async () => undefined),
  };
  const riskIndicatorModelAction = {
    deleteForTransactions: vi.fn(async () => undefined),
    insertMany: vi.fn(async () => undefined),
  };
  const service = new UploadScoringService(
    dataSource as unknown as DataSource,
    detectionService as unknown as DetectionService,
    transactionModelAction as unknown as TransactionModelAction,
    riskIndicatorModelAction as unknown as RiskIndicatorModelAction,
  );
  return { service, manager, transactionModelAction, riskIndicatorModelAction };
};

describe('UploadScoringService.score', () => {
  it('replaces old indicators and saves scores in one database transaction', async () => {
    const { service, manager, transactionModelAction, riskIndicatorModelAction } = setup();
    await expect(
      service.score([tx('a', '2026-10-01T10:00:00Z'), tx('b', '2026-10-05T10:00:00Z')]),
    ).resolves.toEqual({ scored: 2, flagged: 1 });

    expect(riskIndicatorModelAction.deleteForTransactions).toHaveBeenCalledWith(['a', 'b'], manager);
    expect(riskIndicatorModelAction.insertMany).toHaveBeenCalledWith(
      [expect.objectContaining({ transactionId: 'a', weight: 80 })],
      manager,
    );
    expect(transactionModelAction.saveRiskResults).toHaveBeenCalledWith(expect.any(Array), manager);
  });

  it('loads 90 days of customer history before the earliest transaction', async () => {
    const { service, transactionModelAction } = setup();
    await service.score([tx('a', '2026-10-01T10:00:00Z'), tx('b', '2026-10-05T10:00:00Z')]);
    expect(transactionModelAction.findCustomerHistory).toHaveBeenCalledWith(
      ['CUST-1'],
      new Date('2026-07-03T10:00:00Z'),
      new Date('2026-10-05T10:00:00Z'),
    );
  });

  it('does nothing without transactions', async () => {
    const { service, riskIndicatorModelAction } = setup();
    await expect(service.score([])).resolves.toEqual({ scored: 0, flagged: 0 });
    expect(riskIndicatorModelAction.deleteForTransactions).not.toHaveBeenCalled();
  });
});
