import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RejectedRowModelAction } from '../model-actions/rejected-row-model-action.js';
import { UploadBatchModelAction } from '../model-actions/upload-batch-model-action.js';
import { UploadBatchModel } from '../models/upload-batch.model.js';

// Creates and reads upload records
@Injectable()
export class UploadBatchService {
  constructor(
    private readonly uploadBatchModelAction: UploadBatchModelAction,
    private readonly rejectedRowModelAction: RejectedRowModelAction,
  ) {}

  // Refuses a file whose exact content was already uploaded. Failed uploads
  // don't count, so a file can be retried after a failure.
  async assertNotUploadedBefore(file: Buffer): Promise<string> {
    const fileHash = createHash('sha256').update(file).digest('hex');
    const previous = await this.uploadBatchModelAction.findNotFailedByHash(fileHash);
    if (previous) {
      throw new ConflictException(
        `This file was already uploaded (upload ${previous.id}, ${previous.createdAt.toISOString().slice(0, 10)})`,
      );
    }
    return fileHash;
  }

  create(fileName: string, fileHash: string, uploadedById: string): Promise<UploadBatchModel> {
    return this.uploadBatchModelAction.create({
      fileName: fileName.slice(0, 255),
      fileHash,
      uploadedById,
    });
  }

  list(page: number, limit: number) {
    return this.uploadBatchModelAction.findWithPagination(page, limit, {
      order: { createdAt: 'DESC' },
    });
  }

  async get(id: string): Promise<UploadBatchModel> {
    const upload = await this.uploadBatchModelAction.findById(id);
    if (!upload) throw new NotFoundException('Upload not found');
    return upload;
  }

  async listRejected(id: string, page: number, limit: number) {
    await this.get(id);
    return this.rejectedRowModelAction.findPageForUpload(id, page, limit);
  }
}
