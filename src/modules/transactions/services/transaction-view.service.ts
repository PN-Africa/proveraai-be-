import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../audit/enums/audit-action.enum.js';
import { ListTransactionsQueryDto } from '../dtos/list-transactions-query.dto.js';
import { ReviewStatus } from '../enums/review-status.enum.js';
import { RiskIndicatorModelAction } from '../model-actions/risk-indicator-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { ReviewModel } from '../models/review.model.js';
import { RiskIndicatorModel } from '../models/risk-indicator.model.js';
import { TransactionModel } from '../models/transaction.model.js';

export const toReviewView = (review: ReviewModel) => ({
  status: ReviewStatus.CLOSED,
  decision: review.decision,
  notes: review.notes,
  reviewer: { id: review.reviewerId, fullName: review.reviewer?.fullName ?? null },
  decidedAt: review.decidedAt,
});

// null for transactions that are not flagged, which are never reviewed
export const reviewStatusOf = (t: TransactionModel) =>
  t.review ? ReviewStatus.CLOSED : t.flagged ? ReviewStatus.OPEN : null;

const toTransactionView = (t: TransactionModel) => ({
  id: t.id,
  transactionId: t.transactionId,
  uploadId: t.uploadId,
  amount: t.amount,
  currency: t.currency,
  occurredAt: t.occurredAt,
  type: t.type,
  customerId: t.customerId,
  paymentMethod: t.paymentMethod,
  location: t.location,
  riskScore: t.riskScore,
  riskLevel: t.riskLevel,
  flagged: t.flagged,
  reviewStatus: reviewStatusOf(t),
  review: t.review ? toReviewView(t.review) : null,
});

// The owner edits the rules, so they see each rule's weight too
const toIndicatorView = (indicator: RiskIndicatorModel) => ({
  ruleKey: indicator.ruleKey,
  ruleName: indicator.ruleName,
  weight: indicator.weight,
  reason: indicator.reason,
  details: indicator.details,
});

// Read side of the user's own transactions: lists with filters, and one
// transaction with the reasons behind its risk level
@Injectable()
export class TransactionViewService {
  constructor(
    private readonly transactionModelAction: TransactionModelAction,
    private readonly riskIndicatorModelAction: RiskIndicatorModelAction,
    private readonly auditService: AuditService,
  ) {}

  async list(query: ListTransactionsQueryDto, user: AuthUser) {
    const result = await this.transactionModelAction.findPage(
      user.id,
      {
        riskLevel: query.riskLevel,
        flagged: query.flagged,
        reviewStatus: query.reviewStatus,
        uploadId: query.uploadId,
        customerId: query.customerId,
        type: query.type,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      query.page ?? 1,
      query.limit ?? 20,
    );
    return { ...result, data: result.data.map(toTransactionView) };
  }

  async get(id: string, user: AuthUser) {
    const transaction = await this.transactionModelAction.findWithReview(id, user.id);
    if (!transaction) throw new NotFoundException('Transaction not found');
    const indicators = await this.riskIndicatorModelAction.findForTransaction(id);
    await this.auditService.record({ action: AuditAction.TRANSACTION_VIEWED, entityType: 'transaction', entityId: id });
    return {
      ...toTransactionView(transaction),
      attributes: transaction.attributes,
      scoredAt: transaction.scoredAt,
      indicators: indicators.map(toIndicatorView),
    };
  }
}
