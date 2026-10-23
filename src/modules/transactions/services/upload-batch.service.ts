import { Injectable, NotFoundException } from '@nestjs/common';
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

  create(fileName: string, uploadedById: string): Promise<UploadBatchModel> {
    return this.uploadBatchModelAction.create({
      fileName: fileName.slice(0, 255),
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
