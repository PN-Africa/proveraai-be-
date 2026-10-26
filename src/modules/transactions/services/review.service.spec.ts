import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { Role } from '../../auth/enums/role.enum.js';
import { ReviewDecision } from '../enums/review-decision.enum.js';
import { ReviewStatus } from '../enums/review-status.enum.js';
import { ReviewModelAction } from '../model-actions/review-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { ReviewModel } from '../models/review.model.js';
import { ReviewService } from './review.service.js';

const analyst = (id: string) => ({ id, role: Role.ANALYST }) as AuthUser;
const ada = analyst('analyst-1');
const decision = { decision: ReviewDecision.CLEARED, notes: 'Customer confirmed the payment by phone' };

// A tiny in-memory reviews table with the same rules as the model action
const setup = ({ flagged = true, exists = true, existing = null as Partial<ReviewModel> | null } = {}) => {
  let review = existing ? ({ transactionId: 'tx-1', ...existing } as ReviewModel) : null;
  const transactionModelAction = {
    findById: vi.fn(async () => (exists ? { id: 'tx-1', flagged } : null)),
  };
  const reviewModelAction = {
    claim: vi.fn(async (transactionId: string, reviewerId: string) => {
      review ??= { transactionId, reviewerId, status: ReviewStatus.IN_REVIEW } as ReviewModel;
    }),
    findForTransaction: vi.fn(async () => review),
    close: vi.fn(async (_id: string, reviewerId: string, d: ReviewDecision, notes: string) => {
      if (review?.reviewerId !== reviewerId || review.status !== ReviewStatus.IN_REVIEW) return false;
      Object.assign(review, { status: ReviewStatus.CLOSED, decision: d, notes });
      return true;
    }),
  };
  const service = new ReviewService(
    transactionModelAction as unknown as TransactionModelAction,
    reviewModelAction as unknown as ReviewModelAction,
  );
  return { service, reviewModelAction };
};

describe('ReviewService', () => {
  describe('claim', () => {
    it('moves an open flagged transaction to IN_REVIEW for the analyst', async () => {
      const { service } = setup();
      await expect(service.claim('tx-1', ada)).resolves.toMatchObject({
        status: ReviewStatus.IN_REVIEW,
        reviewer: { id: 'analyst-1' },
      });
    });

    it('returns the same review when the analyst claims it again', async () => {
      const { service } = setup({ existing: { reviewerId: 'analyst-1', status: ReviewStatus.IN_REVIEW } });
      await expect(service.claim('tx-1', ada)).resolves.toMatchObject({ status: ReviewStatus.IN_REVIEW });
    });

    it('refuses a transaction claimed by another analyst', async () => {
      const { service } = setup({ existing: { reviewerId: 'analyst-2', status: ReviewStatus.IN_REVIEW } });
      await expect(service.claim('tx-1', ada)).rejects.toThrow(
        new ConflictException('Another analyst is already reviewing this transaction'),
      );
    });

    it('refuses a transaction already reviewed', async () => {
      const { service } = setup({ existing: { reviewerId: 'analyst-1', status: ReviewStatus.CLOSED } });
      await expect(service.claim('tx-1', ada)).rejects.toThrow(ConflictException);
    });

    it('only reviews flagged transactions that exist', async () => {
      await expect(setup({ flagged: false }).service.claim('tx-1', ada)).rejects.toThrow(BadRequestException);
      await expect(setup({ exists: false }).service.claim('tx-1', ada)).rejects.toThrow(NotFoundException);
    });
  });

  describe('decide', () => {
    it('closes the review with the decision and notes', async () => {
      const { service } = setup({ existing: { reviewerId: 'analyst-1', status: ReviewStatus.IN_REVIEW } });
      await expect(service.decide('tx-1', decision, ada)).resolves.toMatchObject({
        status: ReviewStatus.CLOSED,
        decision: ReviewDecision.CLEARED,
        notes: decision.notes,
      });
    });

    it('lets only the claiming analyst decide (AR-17)', async () => {
      const { service } = setup({ existing: { reviewerId: 'analyst-2', status: ReviewStatus.IN_REVIEW } });
      await expect(service.decide('tx-1', decision, ada)).rejects.toThrow(ForbiddenException);
    });

    it('decides only once', async () => {
      const { service } = setup({ existing: { reviewerId: 'analyst-1', status: ReviewStatus.IN_REVIEW } });
      await service.decide('tx-1', decision, ada);
      await expect(
        service.decide('tx-1', { ...decision, decision: ReviewDecision.ESCALATED }, ada),
      ).rejects.toThrow(new ConflictException('This transaction has already been reviewed'));
    });

    it('needs a claim first', async () => {
      await expect(setup().service.decide('tx-1', decision, ada)).rejects.toThrow(
        new ConflictException('Claim this transaction before recording a decision'),
      );
      await expect(setup({ exists: false }).service.decide('tx-1', decision, ada)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
