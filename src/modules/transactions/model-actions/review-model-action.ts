import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { ReviewDecision } from '../enums/review-decision.enum.js';
import { ReviewModel } from '../models/review.model.js';

@Injectable()
export class ReviewModelAction extends AbstractModel<ReviewModel> {
  constructor(
    @InjectRepository(ReviewModel)
    private readonly reviewRepository: Repository<ReviewModel>,
  ) {
    super(reviewRepository, ReviewModel);
  }

  // Records the decision unless the transaction already has one; the unique
  // transactionId makes a double submit store only one. False if one existed.
  async decide(
    transactionId: string,
    reviewerId: string,
    decision: ReviewDecision,
    notes: string,
  ): Promise<boolean> {
    const result = await this.reviewRepository
      .createQueryBuilder()
      .insert()
      .into(ReviewModel)
      .values({ transactionId, reviewerId, decision, notes, decidedAt: new Date() })
      .orIgnore()
      .returning(['id'])
      .execute();
    return (result.raw as unknown[]).length > 0;
  }

  findForTransaction(transactionId: string): Promise<ReviewModel | null> {
    return this.reviewRepository
      .createQueryBuilder('r')
      .leftJoin('r.reviewer', 'reviewer')
      .addSelect(['reviewer.id', 'reviewer.fullName'])
      .where('r.transactionId = :transactionId', { transactionId })
      .getOne();
  }
}
