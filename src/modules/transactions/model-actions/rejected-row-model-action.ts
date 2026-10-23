import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { RejectedRowModel } from '../models/rejected-row.model.js';

export type NewRejectedRow = Pick<
  RejectedRowModel,
  'uploadId' | 'rowNumber' | 'transactionId' | 'reasons'
>;

@Injectable()
export class RejectedRowModelAction extends AbstractModel<RejectedRowModel> {
  constructor(
    @InjectRepository(RejectedRowModel)
    private readonly rejectedRowRepository: Repository<RejectedRowModel>,
  ) {
    super(rejectedRowRepository, RejectedRowModel);
  }

  async insertMany(rows: NewRejectedRow[]): Promise<void> {
    if (rows.length > 0) await this.rejectedRowRepository.insert(rows);
  }

  findPageForUpload(uploadId: string, page: number, limit: number) {
    return this.findWithPagination(page, limit, {
      where: { uploadId },
      order: { rowNumber: 'ASC' },
    });
  }
}
