import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../audit/enums/audit-action.enum.js';
import { ReviewDecisionDto } from '../dtos/review-decision.dto.js';
import { ReviewStatus } from '../enums/review-status.enum.js';
import { ReviewModelAction } from '../model-actions/review-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { toReviewView } from './transaction-view.service.js';

// Analyst review of flagged transactions:
// OPEN -> IN_REVIEW (claimed) -> CLOSED (CLEARED or ESCALATED, with notes).
// Only the analyst who claimed a review can decide it (AR-17).
@Injectable()
export class ReviewService {
  constructor(
    private readonly transactionModelAction: TransactionModelAction,
    private readonly reviewModelAction: ReviewModelAction,
    private readonly auditService: AuditService,
  ) {}

  // Claiming again a review you already hold returns it unchanged
  async claim(transactionId: string, analyst: AuthUser) {
    const transaction = await this.transactionModelAction.findById(transactionId);
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (!transaction.flagged) throw new BadRequestException('Only flagged transactions are reviewed');

    await this.reviewModelAction.claim(transactionId, analyst.id);
    const review = await this.reviewModelAction.findForTransaction(transactionId);
    if (!review) throw new NotFoundException('Transaction not found');
    if (review.status === ReviewStatus.CLOSED) {
      throw new ConflictException('This transaction has already been reviewed');
    }
    if (review.reviewerId !== analyst.id) {
      throw new ConflictException('Another analyst is already reviewing this transaction');
    }
    await this.auditService.record({
      action: AuditAction.REVIEW_CLAIMED,
      entityType: 'transaction',
      entityId: transactionId,
    });
    return toReviewView(review);
  }

  async decide(transactionId: string, dto: ReviewDecisionDto, analyst: AuthUser) {
    const closed = await this.reviewModelAction.close(
      transactionId,
      analyst.id,
      dto.decision,
      dto.notes,
    );
    const review = await this.reviewModelAction.findForTransaction(transactionId);
    if (closed && review) {
      await this.auditService.record({
        action: AuditAction.REVIEW_DECIDED,
        entityType: 'transaction',
        entityId: transactionId,
        metadata: { decision: dto.decision },
      });
      return toReviewView(review);
    }

    if (!review) {
      if (!(await this.transactionModelAction.findById(transactionId))) {
        throw new NotFoundException('Transaction not found');
      }
      throw new ConflictException('Claim this transaction before recording a decision');
    }
    if (review.status === ReviewStatus.CLOSED) {
      throw new ConflictException('This transaction has already been reviewed');
    }
    throw new ForbiddenException('Only the analyst reviewing this transaction can record its decision');
  }
}
