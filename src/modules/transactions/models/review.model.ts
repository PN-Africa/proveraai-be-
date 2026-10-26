import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne, type Relation } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { AccountModel } from '../../auth/models/auth.model.js';
import { ReviewDecision } from '../enums/review-decision.enum.js';
import { ReviewStatus } from '../enums/review-status.enum.js';
import { TransactionModel } from './transaction.model.js';

// An analyst's review of one flagged transaction. Created when an analyst
// claims it; the decision is the platform's determination, not the risk level.
@Entity('reviews')
export class ReviewModel extends BaseEntity {
  // One review per transaction (unique), so two analysts cannot both claim it
  @Column({ type: 'uuid' })
  transactionId!: string;

  @OneToOne(() => TransactionModel, (transaction) => transaction.review, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction?: Relation<TransactionModel>;

  @Index()
  @Column({ type: 'uuid' })
  reviewerId!: string;

  @ManyToOne(() => AccountModel)
  @JoinColumn({ name: 'reviewerId' })
  reviewer?: AccountModel;

  @Index()
  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.IN_REVIEW })
  status!: ReviewStatus;

  @Column({ type: 'enum', enum: ReviewDecision, nullable: true })
  decision!: ReviewDecision | null;

  // Required with the decision (TR-14)
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamptz' })
  claimedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;
}
