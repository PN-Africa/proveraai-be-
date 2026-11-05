import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../audit/enums/audit-action.enum.js';
import { ReviewDecisionDto } from '../dtos/review-decision.dto.js';
import { ReviewModelAction } from '../model-actions/review-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { toReviewView } from './transaction-view.service.js';

// The owner reviews their own flagged transactions:
// OPEN -> CLOSED (CLEARED or ESCALATED, with notes), once.
@Injectable()
export class ReviewService {
  constructor(
    private readonly transactionModelAction: TransactionModelAction,
    private readonly reviewModelAction: ReviewModelAction,
    private readonly auditService: AuditService,
  ) {}

  async decide(transactionId: string, dto: ReviewDecisionDto, user: AuthUser) {
    const transaction = await this.transactionModelAction.findOne({
      where: { id: transactionId, ownerId: user.id },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (!transaction.flagged) throw new BadRequestException('Only flagged transactions are reviewed');

    if (!(await this.reviewModelAction.decide(transactionId, user.id, dto.decision, dto.notes))) {
      throw new ConflictException('This transaction has already been reviewed');
    }
    await this.auditService.record({
      action: AuditAction.REVIEW_DECIDED,
      entityType: 'transaction',
      entityId: transactionId,
      metadata: { decision: dto.decision },
    });
    const review = await this.reviewModelAction.findForTransaction(transactionId);
    if (!review) throw new NotFoundException('Transaction not found');
    return toReviewView(review);
  }
}
