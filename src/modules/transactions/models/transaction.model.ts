import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne, type Relation } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { RiskLevel } from '../../detection/enums/risk-level.enum.js';
import { ReviewModel } from './review.model.js';
import { UploadBatchModel } from './upload-batch.model.js';

@Entity('transactions')
@Index(['ownerId', 'transactionId'], { unique: true })
export class TransactionModel extends BaseEntity {
  // The account that uploaded it. Every read and every score is scoped to it.
  @Index()
  @Column({ type: 'uuid' })
  ownerId!: string;

  @Index()
  @Column({ type: 'uuid' })
  uploadId!: string;

  @ManyToOne(() => UploadBatchModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploadId' })
  upload?: UploadBatchModel;

  // The Transaction ID from the uploaded file. Unique per owner, so an owner's
  // re-upload is rejected while another account can upload the same data.
  @Column({ length: 100 })
  transactionId!: string;

  // numeric comes back from Postgres as a string, which keeps it exact
  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string;

  @Column({ length: 10 })
  currency!: string;

  @Index()
  @Column({ type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ length: 50 })
  type!: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  customerId!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location!: string | null;

  // Extra columns from the file ("other relevant attributes")
  @Column({ type: 'jsonb', default: () => "'{}'" })
  attributes!: Record<string, string>;

  // Set once by detection, never through the API (R-02). Null until scored.
  @Column({ type: 'int', nullable: true })
  riskScore!: number | null;

  @Index()
  @Column({ type: 'varchar', length: 10, nullable: true })
  riskLevel!: RiskLevel | null;

  // true = requires review, never "fraudulent"
  @Index()
  @Column({ default: false })
  flagged!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  scoredAt!: Date | null;

  @OneToOne(() => ReviewModel, (review) => review.transaction)
  review?: Relation<ReviewModel> | null;
}
