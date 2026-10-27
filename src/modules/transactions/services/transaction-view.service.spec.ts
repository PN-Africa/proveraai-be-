import { AuditService } from '../../audit/audit.service.js';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { Role } from '../../auth/enums/role.enum.js';
import { RiskLevel } from '../../detection/enums/risk-level.enum.js';
import { ReviewStatus } from '../enums/review-status.enum.js';
import { RiskIndicatorModelAction } from '../model-actions/risk-indicator-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { TransactionModel } from '../models/transaction.model.js';
import { TransactionViewService } from './transaction-view.service.js';

const user = (role: Role) => ({ id: 'user-1', role }) as AuthUser;

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
  it('hides rule weights from analysts (TR-11)', async () => {
    const [indicator] = (await setup().service.get('tx-1', user(Role.ANALYST))).indicators;
    expect(indicator).toEqual({
      ruleName: 'High-value transaction (NGN)',
      reason: 'High-value transaction of NGN 950,000',
      details: {},
    });
  });

  it('shows rule weights to admins', async () => {
    const [indicator] = (await setup().service.get('tx-1', user(Role.ADMIN))).indicators;
    expect(indicator).toMatchObject({ ruleKey: 'high-amount-ngn', weight: 30 });
  });

  it('marks a flagged transaction with no review as OPEN, and others as not reviewable', async () => {
    const { service } = setup();
    expect((await service.get('tx-1', user(Role.ANALYST))).reviewStatus).toBe(ReviewStatus.OPEN);
    const notFlagged = setup(transaction({ flagged: false })).service;
    expect((await notFlagged.get('tx-1', user(Role.ANALYST))).reviewStatus).toBeNull();
  });

  it('turns query filters into model filters, scoping "mine" to the user', async () => {
    const { service, transactionModelAction } = setup();
    await service.list(
      { reviewStatus: ReviewStatus.IN_REVIEW, mine: true, from: '2026-10-01T00:00:00Z' },
      user(Role.ANALYST),
    );
    expect(transactionModelAction.findPage).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: ReviewStatus.IN_REVIEW,
        reviewerId: 'user-1',
        from: new Date('2026-10-01T00:00:00Z'),
      }),
      1,
      20,
    );
  });

  it('returns 404 for an unknown transaction', async () => {
    await expect(setup(null).service.get('tx-1', user(Role.ANALYST))).rejects.toThrow('Transaction not found');
  });
});
