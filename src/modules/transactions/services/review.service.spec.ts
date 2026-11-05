import { AuditService } from '../../audit/audit.service.js';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { Role } from '../../auth/enums/role.enum.js';
import { ReviewDecision } from '../enums/review-decision.enum.js';
import { ReviewStatus } from '../enums/review-status.enum.js';
import { ReviewModelAction } from '../model-actions/review-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { ReviewModel } from '../models/review.model.js';
import { ReviewService } from './review.service.js';

const ada = { id: 'analyst-1', role: Role.ANALYST } as AuthUser;
const decision = { decision: ReviewDecision.CLEARED, notes: 'Customer confirmed the payment by phone' };

// A tiny in-memory store with the same rules as the model actions: the
// transaction belongs to analyst-1 and has at most one review
const setup = ({ flagged = true, ownerId = 'analyst-1' } = {}) => {
  let review: ReviewModel | null = null;
  const transactionModelAction = {
    findOne: vi.fn(async ({ where }: { where: { id: string; ownerId: string } }) =>
      where.ownerId === ownerId ? { id: where.id, ownerId, flagged } : null,
    ),
  };
  const reviewModelAction = {
    decide: vi.fn(async (transactionId: string, reviewerId: string, d: ReviewDecision, notes: string) => {
      if (review) return false;
      review = { transactionId, reviewerId, decision: d, notes, decidedAt: new Date() } as ReviewModel;
      return true;
    }),
    findForTransaction: vi.fn(async () => review),
  };
  const auditService = { record: vi.fn(async () => undefined) };
  const service = new ReviewService(
    transactionModelAction as unknown as TransactionModelAction,
    reviewModelAction as unknown as ReviewModelAction,
    auditService as unknown as AuditService,
  );
  return { service, auditService };
};

describe('ReviewService.decide', () => {
  it('closes an open flagged transaction with the decision and notes', async () => {
    await expect(setup().service.decide('tx-1', decision, ada)).resolves.toMatchObject({
      status: ReviewStatus.CLOSED,
      decision: ReviewDecision.CLEARED,
      notes: decision.notes,
      reviewer: { id: 'analyst-1' },
    });
  });

  it('audits the decision, and nothing when refused', async () => {
    const { service, auditService } = setup();
    await service.decide('tx-1', decision, ada);
    expect(auditService.record).toHaveBeenCalledWith({
      action: 'review.decided',
      entityType: 'transaction',
      entityId: 'tx-1',
      metadata: { decision: ReviewDecision.CLEARED },
    });
    await service.decide('tx-1', decision, ada).catch(() => undefined);
    expect(auditService.record).toHaveBeenCalledTimes(1);
  });

  it('decides only once', async () => {
    const { service } = setup();
    await service.decide('tx-1', decision, ada);
    await expect(
      service.decide('tx-1', { ...decision, decision: ReviewDecision.ESCALATED }, ada),
    ).rejects.toThrow(new ConflictException('This transaction has already been reviewed'));
  });

  it('only reviews flagged transactions', async () => {
    await expect(setup({ flagged: false }).service.decide('tx-1', decision, ada)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("treats another account's transaction as not found", async () => {
    await expect(setup({ ownerId: 'analyst-2' }).service.decide('tx-1', decision, ada)).rejects.toThrow(
      NotFoundException,
    );
  });
});
