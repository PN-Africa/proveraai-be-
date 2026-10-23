import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { TransactionModel } from '../models/transaction.model.js';

export type NewTransaction = Omit<
  TransactionModel,
  'id' | 'createdAt' | 'updatedAt' | 'upload'
>;

@Injectable()
export class TransactionModelAction extends AbstractModel<TransactionModel> {
  constructor(
    @InjectRepository(TransactionModel)
    private readonly transactionRepository: Repository<TransactionModel>,
  ) {
    super(transactionRepository, TransactionModel);
  }

  // Inserts the rows whose transactionId is not stored yet and returns the
  // transactionIds that were inserted. Existing ones are skipped in the same
  // statement, so two uploads at once cannot both store a transaction.
  async insertNew(rows: NewTransaction[]): Promise<string[]> {
    if (rows.length === 0) return [];
    const result = await this.transactionRepository
      .createQueryBuilder()
      .insert()
      .into(TransactionModel)
      .values(rows)
      .orIgnore()
      .returning(['transactionId'])
      .execute();
    return (result.raw as { transactionId: string }[]).map((r) => r.transactionId);
  }
}
