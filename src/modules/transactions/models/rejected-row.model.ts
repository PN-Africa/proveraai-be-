import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { UploadBatchModel } from './upload-batch.model.js';

@Entity('rejected_rows')
export class RejectedRowModel extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  uploadId!: string;

  @ManyToOne(() => UploadBatchModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploadId' })
  upload?: UploadBatchModel;

  // Line number in the file (the header is line 1)
  @Column({ type: 'int' })
  rowNumber!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionId!: string | null;

  @Column({ type: 'jsonb' })
  reasons!: string[];
}
