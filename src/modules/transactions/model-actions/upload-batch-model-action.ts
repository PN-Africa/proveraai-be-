import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { UploadStatus } from '../enums/upload-status.enum.js';
import { UploadBatchModel } from '../models/upload-batch.model.js';

export interface UploadCounts {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
}

@Injectable()
export class UploadBatchModelAction extends AbstractModel<UploadBatchModel> {
  constructor(
    @InjectRepository(UploadBatchModel)
    private readonly uploadBatchRepository: Repository<UploadBatchModel>,
  ) {
    super(uploadBatchRepository, UploadBatchModel);
  }

  // The earliest upload of this content that did not fail
  async findNotFailedByHash(fileHash: string): Promise<UploadBatchModel | null> {
    return this.uploadBatchRepository.findOne({
      where: { fileHash, status: Not(UploadStatus.FAILED) },
      order: { createdAt: 'ASC' },
    });
  }

  async markProcessing(id: string): Promise<void> {
    await this.uploadBatchRepository.update(id, {
      status: UploadStatus.PROCESSING,
      startedAt: new Date(),
    });
  }

  async markCompleted(id: string, counts: UploadCounts): Promise<void> {
    await this.uploadBatchRepository.update(id, {
      ...counts,
      status: UploadStatus.COMPLETED,
      completedAt: new Date(),
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.uploadBatchRepository.update(id, {
      status: UploadStatus.FAILED,
      error,
      completedAt: new Date(),
    });
  }
}
