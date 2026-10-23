import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { UploadBatchModel } from './upload-batch.model.js';

@Entity('transactions')
export class TransactionModel extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  uploadId!: string;

  @ManyToOne(() => UploadBatchModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploadId' })
  upload?: UploadBatchModel;

  // The Transaction ID from the uploaded file. Unique, so re-uploads are rejected.
  @Column({ length: 100, unique: true })
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
}
