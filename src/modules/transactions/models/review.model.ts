import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne, type Relation } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { AccountModel } from '../../auth/models/auth.model.js';
import { ReviewDecision } from '../enums/review-decision.enum.js';
import { TransactionModel } from './transaction.model.js';

// The owner's decision on one flagged transaction. It exists only once
// decided; the decision is the platform's determination, not the risk level.
@Entity('reviews')
export class ReviewModel extends BaseEntity {
  // One review per transaction (unique), so it can be decided only once
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

  @Column({ type: 'enum', enum: ReviewDecision })
  decision!: ReviewDecision;

  // Required with the decision (TR-14)
  @Column({ type: 'text' })
  notes!: string;

  @Column({ type: 'timestamptz' })
  decidedAt!: Date;
}
