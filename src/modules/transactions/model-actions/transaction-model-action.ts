import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { RiskLevel } from '../../detection/enums/risk-level.enum.js';
import { TransactionModel } from '../models/transaction.model.js';

export type NewTransaction = Omit<
  TransactionModel,
  'id' | 'createdAt' | 'updatedAt' | 'upload' | 'riskScore' | 'riskLevel' | 'flagged' | 'scoredAt'
>;

export interface RiskResult {
  id: string;
  riskScore: number;
  riskLevel: RiskLevel;
  flagged: boolean;
}

const CHUNK = 1000;

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

  findForUpload(uploadId: string): Promise<TransactionModel[]> {
    return this.transactionRepository.find({ where: { uploadId } });
  }

  // Earlier context for the given customers from other uploads
  async findCustomerHistory(
    customerIds: string[],
    excludeUploadId: string,
    from: Date,
    to: Date,
  ): Promise<TransactionModel[]> {
    const history: TransactionModel[] = [];
    for (let i = 0; i < customerIds.length; i += CHUNK) {
      history.push(
        ...(await this.transactionRepository.find({
          where: {
            customerId: In(customerIds.slice(i, i + CHUNK)),
            uploadId: Not(excludeUploadId),
            occurredAt: Between(from, to),
          },
        })),
      );
    }
    return history;
  }

  // One parameterised statement per chunk instead of one UPDATE per row
  async saveRiskResults(results: RiskResult[]): Promise<void> {
    for (let i = 0; i < results.length; i += CHUNK) {
      const chunk = results.slice(i, i + CHUNK);
      await this.transactionRepository.query(
        `UPDATE "transactions" AS t
         SET "riskScore" = v.score, "riskLevel" = v.level, "flagged" = v.flagged, "scoredAt" = now()
         FROM unnest($1::uuid[], $2::int[], $3::varchar[], $4::boolean[]) AS v(id, score, level, flagged)
         WHERE t.id = v.id`,
        [
          chunk.map((r) => r.id),
          chunk.map((r) => r.riskScore),
          chunk.map((r) => r.riskLevel),
          chunk.map((r) => r.flagged),
        ],
      );
    }
  }
}
