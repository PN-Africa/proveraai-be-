import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { ReviewDecision } from '../enums/review-decision.enum.js';
import { ReviewStatus } from '../enums/review-status.enum.js';
import { ReviewModel } from '../models/review.model.js';

@Injectable()
export class ReviewModelAction extends AbstractModel<ReviewModel> {
  constructor(
    @InjectRepository(ReviewModel)
    private readonly reviewRepository: Repository<ReviewModel>,
  ) {
    super(reviewRepository, ReviewModel);
  }

  // Creates the review unless one exists. The unique transactionId makes this
  // safe when two analysts claim at the same moment: only one row is created.
  async claim(transactionId: string, reviewerId: string): Promise<void> {
    await this.reviewRepository
      .createQueryBuilder()
      .insert()
      .into(ReviewModel)
      .values({ transactionId, reviewerId, status: ReviewStatus.IN_REVIEW, claimedAt: new Date() })
      .orIgnore()
      .execute();
  }

  findForTransaction(transactionId: string): Promise<ReviewModel | null> {
    return this.reviewRepository
      .createQueryBuilder('r')
      .leftJoin('r.reviewer', 'reviewer')
      .addSelect(['reviewer.id', 'reviewer.fullName'])
      .where('r.transactionId = :transactionId', { transactionId })
      .getOne();
  }

  // Scoped to the claiming analyst and an open review (AR-17), so the check
  // and the write are one statement. Returns false if nothing matched.
  async close(
    transactionId: string,
    reviewerId: string,
    decision: ReviewDecision,
    notes: string,
  ): Promise<boolean> {
    const result = await this.reviewRepository.update(
      { transactionId, reviewerId, status: ReviewStatus.IN_REVIEW },
      { status: ReviewStatus.CLOSED, decision, notes, decidedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }
}
