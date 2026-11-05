import { AuditService } from '../../audit/audit.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { Role } from '../../auth/enums/role.enum.js';
import { RiskLevel } from '../../detection/enums/risk-level.enum.js';
import { ReviewDecision } from '../enums/review-decision.enum.js';
import { RiskIndicatorModelAction } from '../model-actions/risk-indicator-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { TransactionModel } from '../models/transaction.model.js';
import {
  CustomerHistoryExportService,
  MAX_EXPORT_ROWS,
  toCsvCell,
} from './customer-history-export.service.js';

const analyst = { id: 'analyst-1', role: Role.ANALYST } as AuthUser;

const tx = (overrides: Partial<TransactionModel>) =>
  ({
    id: 'tx-1',
    transactionId: 'TXN-1',
    occurredAt: new Date('2026-10-01T10:00:00Z'),
    amount: '50000.00',
    currency: 'NGN',
    type: 'PAYMENT',
    customerId: 'CUST 1',
    paymentMethod: 'CARD',
    location: 'Lagos',
    riskScore: 0,
    riskLevel: RiskLevel.LOW,
    flagged: false,
    review: null,
    ...overrides,
  }) as TransactionModel;

const flaggedFields: Partial<TransactionModel> = {
  id: 'tx-2',
  transactionId: 'TXN-2',
  occurredAt: new Date('2026-10-02T03:00:00Z'),
  amount: '950000.00',
  location: 'Kano',
  riskScore: 95,
  riskLevel: RiskLevel.HIGH,
  flagged: true,
};
const flagged = tx(flaggedFields);

const setup = (target: TransactionModel | null = flagged, history = [tx({}), flagged]) => {
  const transactionModelAction = {
    findOne: vi.fn(async () => target),
    findCustomerTransactions: vi.fn(async () => history),
  };
  const riskIndicatorModelAction = {
    findForTransactions: vi.fn(async () => [
      { transactionId: 'tx-2', reason: 'High-value transaction of NGN 950,000' },
      { transactionId: 'tx-2', reason: 'New location for this customer: Kano (usually Lagos)' },
    ]),
  };
  const service = new CustomerHistoryExportService(
    transactionModelAction as unknown as TransactionModelAction,
    riskIndicatorModelAction as unknown as RiskIndicatorModelAction,
    { record: vi.fn() } as unknown as AuditService,
  );
  return { service, transactionModelAction };
};

describe('CustomerHistoryExportService', () => {
  it("exports the customer's transactions with risk, review and reasons", async () => {
    const { service, transactionModelAction } = setup();
    const file = await service.export('tx-2', { from: '2026-09-01T00:00:00Z' }, analyst);

    expect(file.fileName).toBe('customer-CUST_1-transactions.csv');
    expect(file.content.toString('utf8').split('\r\n')).toEqual([
      'transactionId,occurredAt,amount,currency,type,paymentMethod,location,riskScore,riskLevel,flagged,reviewStatus,decision,reasons',
      '"TXN-1","2026-10-01T10:00:00.000Z","50000.00","NGN","PAYMENT","CARD","Lagos","0","LOW","false","","",""',
      '"TXN-2","2026-10-02T03:00:00.000Z","950000.00","NGN","PAYMENT","CARD","Kano","95","HIGH","true","OPEN","",' +
        '"High-value transaction of NGN 950,000; New location for this customer: Kano (usually Lagos)"',
      '',
    ]);
    expect(transactionModelAction.findOne).toHaveBeenCalledWith({ where: { id: 'tx-2', ownerId: 'analyst-1' } });
    expect(transactionModelAction.findCustomerTransactions).toHaveBeenCalledWith(
      'analyst-1',
      'CUST 1',
      new Date('2026-09-01T00:00:00Z'),
      undefined,
      MAX_EXPORT_ROWS + 1,
    );
  });

  it('includes the review decision', async () => {
    const reviewed = tx({
      ...flaggedFields,
      review: { decision: ReviewDecision.ESCALATED } as TransactionModel['review'],
    });
    const file = await setup(reviewed, [reviewed]).service.export('tx-2', {}, analyst);
    expect(file.content.toString()).toContain('"CLOSED","ESCALATED"');
  });

  it('only exports for a flagged transaction with a customer', async () => {
    await expect(setup(null).service.export('x', {}, analyst)).rejects.toThrow(NotFoundException);
    await expect(setup(tx({})).service.export('tx-1', {}, analyst)).rejects.toThrow(
      new BadRequestException('Customer history is available for flagged transactions only'),
    );
    await expect(setup(tx({ ...flaggedFields, customerId: null })).service.export('tx-2', {}, analyst)).rejects.toThrow(
      new BadRequestException('This transaction has no customer ID'),
    );
  });

  it(`refuses more than ${MAX_EXPORT_ROWS} rows`, async () => {
    const tooMany = Array.from({ length: MAX_EXPORT_ROWS + 1 }, () => tx({}));
    await expect(setup(flagged, tooMany).service.export('tx-2', {}, analyst)).rejects.toThrow(BadRequestException);
  });

  it('neutralises spreadsheet formulas and escapes quotes', () => {
    expect(toCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(toCsvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(toCsvCell(null)).toBe('""');
  });
});
