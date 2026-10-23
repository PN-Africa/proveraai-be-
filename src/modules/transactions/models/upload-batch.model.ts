import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { UploadStatus } from '../enums/upload-status.enum.js';

@Entity('upload_batches')
export class UploadBatchModel extends BaseEntity {
  @Column({ length: 255 })
  fileName!: string;

  @Index()
  @Column({ type: 'uuid' })
  uploadedById!: string;

  @Column({ type: 'enum', enum: UploadStatus, default: UploadStatus.PENDING })
  status!: UploadStatus;

  @Column({ type: 'int', default: 0 })
  totalRows!: number;

  @Column({ type: 'int', default: 0 })
  acceptedRows!: number;

  @Column({ type: 'int', default: 0 })
  rejectedRows!: number;

  // Why a FAILED upload failed, safe to show to the uploader
  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
