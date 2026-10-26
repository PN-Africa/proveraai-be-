import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { TransactionModel } from './transaction.model.js';

// One rule that fired for a transaction: the explanation behind its score
@Entity('risk_indicators')
export class RiskIndicatorModel extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  transactionId!: string;

  @ManyToOne(() => TransactionModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction?: TransactionModel;

  // The exact rule version that fired, so the explanation stays accurate
  // after the rule is edited
  @Column({ type: 'uuid' })
  ruleId!: string;

  @Column({ length: 64 })
  ruleKey!: string;

  @Column({ length: 100 })
  ruleName!: string;

  @Column({ type: 'int' })
  weight!: number;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  details!: Record<string, unknown>;
}
