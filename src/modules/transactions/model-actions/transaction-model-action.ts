import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  EntityManager,
  In,
  IsNull,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { RiskLevel } from '../../detection/enums/risk-level.enum.js';
import { ReviewDecision } from '../enums/review-decision.enum.js';
import { ReviewStatus } from '../enums/review-status.enum.js';
import { UploadStatus } from '../enums/upload-status.enum.js';
import { TransactionModel } from '../models/transaction.model.js';

export type NewTransaction = Omit<
  TransactionModel,
  'id' | 'createdAt' | 'updatedAt' | 'upload' | 'riskScore' | 'riskLevel' | 'flagged' | 'scoredAt' | 'review'
>;

export interface TransactionFilters {
  riskLevel?: RiskLevel;
  flagged?: boolean;
  reviewStatus?: ReviewStatus;
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

export interface OccurredRange {
  from?: Date;
  to?: Date;
}

// Limits a query on transactions (alias t) to an occurredAt range
export const inRange = <T extends ObjectLiteral>(query: SelectQueryBuilder<T>, range: OccurredRange) => {
  if (range.from) query.andWhere('t.occurredAt >= :from', { from: range.from });
  if (range.to) query.andWhere('t.occurredAt <= :to', { to: range.to });
  return query;
};

const CHUNK = 1000;

@Injectable()
export class TransactionModelAction extends AbstractModel<TransactionModel> {
  constructor(
    @InjectRepository(TransactionModel)
    private readonly transactionRepository: Repository<TransactionModel>,
  ) {
    super(transactionRepository, TransactionModel);
  }

  // Inserts the rows whose transactionId the owner has not stored yet and
  // returns the transactionIds that were inserted. Existing ones are skipped
  // in the same statement, so two uploads at once cannot both store one.
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

  // The owner's transactions, highest risk first, then most recent. The
  // review comes with its reviewer's id and name only.
  async findPage(ownerId: string, filters: TransactionFilters, page: number, limit: number) {
    const query = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.review', 'r')
      .leftJoin('r.reviewer', 'reviewer')
      .addSelect(['reviewer.id', 'reviewer.fullName'])
      .where('t.ownerId = :ownerId', { ownerId });

    if (filters.riskLevel) query.andWhere('t.riskLevel = :riskLevel', { riskLevel: filters.riskLevel });
    if (filters.flagged !== undefined) query.andWhere('t.flagged = :flagged', { flagged: filters.flagged });
    if (filters.uploadId) query.andWhere('t.uploadId = :uploadId', { uploadId: filters.uploadId });
    if (filters.customerId) query.andWhere('t.customerId = :customerId', { customerId: filters.customerId });
    if (filters.type) query.andWhere('t.type = :type', { type: filters.type });
    inRange(query, filters);
    if (filters.reviewStatus === ReviewStatus.OPEN) query.andWhere('t.flagged = true AND r.id IS NULL');
    if (filters.reviewStatus === ReviewStatus.CLOSED) query.andWhere('r.id IS NOT NULL');

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

  findWithReview(id: string, ownerId: string): Promise<TransactionModel | null> {
    return this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.review', 'r')
      .leftJoin('r.reviewer', 'reviewer')
      .addSelect(['reviewer.id', 'reviewer.fullName'])
      .where('t.id = :id AND t.ownerId = :ownerId', { id, ownerId })
      .getOne();
  }

  // Counts for the owner's dashboard, in one pass. Postgres returns counts as strings.
  summarize(ownerId: string, range: OccurredRange): Promise<Record<string, string> | undefined> {
    const query = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin('t.review', 'r')
      .where('t.ownerId = :ownerId', { ownerId })
      .select('count(*)', 'total')
      .addSelect('count(t.riskLevel)', 'scored')
      .addSelect('count(*) FILTER (WHERE t.flagged)', 'flagged')
      .addSelect('count(*) FILTER (WHERE t.riskLevel = :low)', 'low')
      .addSelect('count(*) FILTER (WHERE t.riskLevel = :medium)', 'medium')
      .addSelect('count(*) FILTER (WHERE t.riskLevel = :high)', 'high')
      .addSelect('count(*) FILTER (WHERE t.flagged AND r.id IS NULL)', 'open')
      .addSelect('count(r.id)', 'closed')
      .addSelect('count(*) FILTER (WHERE r.decision = :cleared)', 'cleared')
      .addSelect('count(*) FILTER (WHERE r.decision = :escalated)', 'escalated')
      .setParameters({
        low: RiskLevel.LOW,
        medium: RiskLevel.MEDIUM,
        high: RiskLevel.HIGH,
        cleared: ReviewDecision.CLEARED,
        escalated: ReviewDecision.ESCALATED,
      });
    return inRange(query, range).getRawOne<Record<string, string>>();
  }

  // Counts per local day or week (period = its first day, YYYY-MM-DD).
  // Periods with no transactions are not returned.
  countByPeriod(
    ownerId: string,
    interval: 'day' | 'week',
    timeZone: string,
    range: Required<OccurredRange>,
  ): Promise<{ period: string; total: string; flagged: string; high: string }[]> {
    const query = this.transactionRepository
      .createQueryBuilder('t')
      .where('t.ownerId = :ownerId', { ownerId })
      .select(`to_char(date_trunc(:interval, t.occurredAt AT TIME ZONE :timeZone), 'YYYY-MM-DD')`, 'period')
      .addSelect('count(*)', 'total')
      .addSelect('count(*) FILTER (WHERE t.flagged)', 'flagged')
      .addSelect('count(*) FILTER (WHERE t.riskLevel = :high)', 'high')
      .setParameters({ interval, timeZone, high: RiskLevel.HIGH });
    return inRange(query, range).groupBy('period').orderBy('period').getRawMany();
  }

  // Oldest first, with the review status of each
  findCustomerTransactions(
    ownerId: string,
    customerId: string,
    from: Date | undefined,
    to: Date | undefined,
    take: number,
  ): Promise<TransactionModel[]> {
    const query = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.review', 'r')
      .where('t.ownerId = :ownerId AND t.customerId = :customerId', { ownerId, customerId });
    return inRange(query, { from, to }).orderBy('t.occurredAt', 'ASC').addOrderBy('t.id').take(take).getMany();
  }

  findForUpload(uploadId: string): Promise<TransactionModel[]> {
    return this.transactionRepository.find({ where: { uploadId } });
  }

  // Reviewed transactions keep the score the reviewer saw
  findUnreviewedForUpload(uploadId: string): Promise<TransactionModel[]> {
    return this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin('t.review', 'r')
      .where('t.uploadId = :uploadId', { uploadId })
      .andWhere('r.id IS NULL')
      .getMany();
  }

  findUnscoredForUpload(uploadId: string): Promise<TransactionModel[]> {
    return this.transactionRepository.find({ where: { uploadId, riskLevel: IsNull() } });
  }

  // The owner's uploads that finished (or failed after storing rows) but have
  // transactions without a score. Uploads still processing are left alone.
  async findUploadIdsWithUnscored(ownerId: string): Promise<string[]> {
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .innerJoin('t.upload', 'u')
      .select('DISTINCT t.uploadId', 'uploadId')
      .where('t.ownerId = :ownerId AND t.riskLevel IS NULL', { ownerId })
      .andWhere('u.status IN (:...statuses)', {
        statuses: [UploadStatus.COMPLETED, UploadStatus.FAILED],
      })
      .getRawMany<{ uploadId: string }>();
    return rows.map((r) => r.uploadId);
  }

  countForUpload(uploadId: string, onlyFlagged = false): Promise<number> {
    return this.transactionRepository.count({
      where: { uploadId, ...(onlyFlagged && { flagged: true }) },
    });
  }

  // Context for the given customers, from the owner's data only, so accounts
  // never affect each other's scores. May include the transactions being
  // scored; the evaluator counts each transaction once.
  async findCustomerHistory(
    ownerId: string,
    customerIds: string[],
    from: Date,
    to: Date,
  ): Promise<TransactionModel[]> {
    const history: TransactionModel[] = [];
    for (let i = 0; i < customerIds.length; i += CHUNK) {
      history.push(
        ...(await this.transactionRepository.find({
          where: {
            ownerId,
            customerId: In(customerIds.slice(i, i + CHUNK)),
            occurredAt: Between(from, to),
          },
        })),
      );
    }
    return history;
  }

  // One parameterised statement per chunk instead of one UPDATE per row
  async saveRiskResults(results: RiskResult[], manager?: EntityManager): Promise<void> {
    const repository = this.getRepository(manager);
    for (let i = 0; i < results.length; i += CHUNK) {
      const chunk = results.slice(i, i + CHUNK);
      await repository.query(
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
