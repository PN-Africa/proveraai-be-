import { AuditService } from '../../audit/audit.service.js';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { Role } from '../../auth/enums/role.enum.js';
import { RiskLevel } from '../../detection/enums/risk-level.enum.js';
import { ReviewStatus } from '../enums/review-status.enum.js';
import { RiskIndicatorModelAction } from '../model-actions/risk-indicator-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { TransactionModel } from '../models/transaction.model.js';
import { TransactionViewService } from './transaction-view.service.js';

const owner = { id: 'user-1', role: Role.ANALYST } as AuthUser;

const transaction = (overrides: Partial<TransactionModel> = {}) =>
  ({
    id: 'tx-1',
    transactionId: 'TXN-1004',
    amount: '950000.00',
    flagged: true,
    riskScore: 95,
    riskLevel: RiskLevel.HIGH,
    review: null,
    attributes: {},
    ...overrides,
  }) as TransactionModel;

const setup = (t: TransactionModel | null = transaction()) => {
  const transactionModelAction = {
    findWithReview: vi.fn(async () => t),
    findPage: vi.fn(async () => ({ data: t ? [t] : [], total: t ? 1 : 0, page: 1, limit: 20 })),
  };
  const riskIndicatorModelAction = {
    findForTransaction: vi.fn(async () => [
      { ruleKey: 'high-amount-ngn', ruleName: 'High-value transaction (NGN)', weight: 30, reason: 'High-value transaction of NGN 950,000', details: {} },
    ]),
  };
  const service = new TransactionViewService(
    transactionModelAction as unknown as TransactionModelAction,
    riskIndicatorModelAction as unknown as RiskIndicatorModelAction,
    { record: vi.fn() } as unknown as AuditService,
  );
  return { service, transactionModelAction };
};

describe('TransactionViewService', () => {
  it('shows the owner each rule with its weight', async () => {
    const { service, transactionModelAction } = setup();
    const [indicator] = (await service.get('tx-1', owner)).indicators;
    expect(indicator).toEqual({
      ruleKey: 'high-amount-ngn',
      ruleName: 'High-value transaction (NGN)',
      weight: 30,
      reason: 'High-value transaction of NGN 950,000',
      details: {},
    });
    expect(transactionModelAction.findWithReview).toHaveBeenCalledWith('tx-1', 'user-1');
  });

  it('marks a flagged transaction with no review as OPEN, and others as not reviewable', async () => {
    const { service } = setup();
    expect((await service.get('tx-1', owner)).reviewStatus).toBe(ReviewStatus.OPEN);
    const notFlagged = setup(transaction({ flagged: false })).service;
    expect((await notFlagged.get('tx-1', owner)).reviewStatus).toBeNull();
  });

  it("lists only the user's own transactions, with the query filters", async () => {
    const { service, transactionModelAction } = setup();
    await service.list({ reviewStatus: ReviewStatus.OPEN, from: '2026-10-01T00:00:00Z' }, owner);
    expect(transactionModelAction.findPage).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        reviewStatus: ReviewStatus.OPEN,
        from: new Date('2026-10-01T00:00:00Z'),
      }),
      1,
      20,
    );
  });

  it("returns 404 for an unknown or another account's transaction", async () => {
    await expect(setup(null).service.get('tx-1', owner)).rejects.toThrow('Transaction not found');
  });
});
