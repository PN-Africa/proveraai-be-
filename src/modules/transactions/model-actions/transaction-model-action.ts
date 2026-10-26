import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { RiskLevel } from '../../detection/enums/risk-level.enum.js';
import { ReviewStatus } from '../enums/review-status.enum.js';
import { TransactionModel } from '../models/transaction.model.js';

export type NewTransaction = Omit<
  TransactionModel,
  'id' | 'createdAt' | 'updatedAt' | 'upload' | 'riskScore' | 'riskLevel' | 'flagged' | 'scoredAt' | 'review'
>;

export interface TransactionFilters {
  riskLevel?: RiskLevel;
  flagged?: boolean;
  reviewStatus?: ReviewStatus;
  reviewerId?: string;
  uploadId?: string;
  customerId?: string;
  type?: string;
  from?: Date;
  to?: Date;
}

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

  // Highest risk first, then most recent. The review comes with its
  // reviewer's id and name only.
  async findPage(filters: TransactionFilters, page: number, limit: number) {
    const query = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.review', 'r')
      .leftJoin('r.reviewer', 'reviewer')
      .addSelect(['reviewer.id', 'reviewer.fullName']);

    if (filters.riskLevel) query.andWhere('t.riskLevel = :riskLevel', { riskLevel: filters.riskLevel });
    if (filters.flagged !== undefined) query.andWhere('t.flagged = :flagged', { flagged: filters.flagged });
    if (filters.uploadId) query.andWhere('t.uploadId = :uploadId', { uploadId: filters.uploadId });
    if (filters.customerId) query.andWhere('t.customerId = :customerId', { customerId: filters.customerId });
    if (filters.type) query.andWhere('t.type = :type', { type: filters.type });
    if (filters.from) query.andWhere('t.occurredAt >= :from', { from: filters.from });
    if (filters.to) query.andWhere('t.occurredAt <= :to', { to: filters.to });
    if (filters.reviewStatus === ReviewStatus.OPEN) {
      query.andWhere('t.flagged = true AND r.id IS NULL');
    } else if (filters.reviewStatus) {
      query.andWhere('r.status = :reviewStatus', { reviewStatus: filters.reviewStatus });
    }
    if (filters.reviewerId) query.andWhere('r.reviewerId = :reviewerId', { reviewerId: filters.reviewerId });

    const [data, total] = await query
      .orderBy('t.riskScore', 'DESC', 'NULLS LAST')
      .addOrderBy('t.occurredAt', 'DESC')
      .addOrderBy('t.id')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  findWithReview(id: string): Promise<TransactionModel | null> {
    return this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.review', 'r')
      .leftJoin('r.reviewer', 'reviewer')
      .addSelect(['reviewer.id', 'reviewer.fullName'])
      .where('t.id = :id', { id })
      .getOne();
  }

  // Oldest first, with the review status of each
  findCustomerTransactions(
    customerId: string,
    from: Date | undefined,
    to: Date | undefined,
    take: number,
  ): Promise<TransactionModel[]> {
    const query = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.review', 'r')
      .where('t.customerId = :customerId', { customerId });
    if (from) query.andWhere('t.occurredAt >= :from', { from });
    if (to) query.andWhere('t.occurredAt <= :to', { to });
    return query.orderBy('t.occurredAt', 'ASC').addOrderBy('t.id').take(take).getMany();
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
