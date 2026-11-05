import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, QueryDeepPartialEntity, Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { RiskIndicatorModel } from '../models/risk-indicator.model.js';
import { inRange, type OccurredRange } from './transaction-model-action.js';

export type NewRiskIndicator = Pick<
  RiskIndicatorModel,
  'transactionId' | 'ruleId' | 'ruleKey' | 'ruleName' | 'weight' | 'reason' | 'details'
>;

const INSERT_CHUNK = 1000;

@Injectable()
export class RiskIndicatorModelAction extends AbstractModel<RiskIndicatorModel> {
  constructor(
    @InjectRepository(RiskIndicatorModel)
    private readonly riskIndicatorRepository: Repository<RiskIndicatorModel>,
  ) {
    super(riskIndicatorRepository, RiskIndicatorModel);
  }

  findForTransaction(transactionId: string): Promise<RiskIndicatorModel[]> {
    return this.riskIndicatorRepository.find({
      where: { transactionId },
      order: { weight: 'DESC', ruleKey: 'ASC' },
    });
  }

  async findForTransactions(transactionIds: string[]): Promise<RiskIndicatorModel[]> {
    const indicators: RiskIndicatorModel[] = [];
    for (let i = 0; i < transactionIds.length; i += INSERT_CHUNK) {
      indicators.push(
        ...(await this.riskIndicatorRepository.find({
          where: { transactionId: In(transactionIds.slice(i, i + INSERT_CHUNK)) },
          order: { weight: 'DESC', ruleKey: 'ASC' },
        })),
      );
    }
    return indicators;
  }

  // Which rules fired most for the owner's transactions in the range. A rule
  // keeps its ruleKey across versions; the name shown is from its latest firing.
  countByRule(
    ownerId: string,
    range: OccurredRange,
    limit: number,
  ): Promise<{ ruleKey: string; ruleName: string; hits: string }[]> {
    const query = this.riskIndicatorRepository
      .createQueryBuilder('ri')
      .innerJoin('ri.transaction', 't')
      .where('t.ownerId = :ownerId', { ownerId })
      .select('ri.ruleKey', 'ruleKey')
      .addSelect('(array_agg(ri.ruleName ORDER BY ri.createdAt DESC))[1]', 'ruleName')
      .addSelect('count(*)', 'hits');
    return inRange(query, range)
      .groupBy('ri.ruleKey')
      .orderBy('hits', 'DESC')
      .addOrderBy('ri.ruleKey')
      .limit(limit)
      .getRawMany();
  }

  async deleteForTransactions(transactionIds: string[], manager?: EntityManager): Promise<void> {
    const repository = this.getRepository(manager);
    for (let i = 0; i < transactionIds.length; i += INSERT_CHUNK) {
      await repository.delete({ transactionId: In(transactionIds.slice(i, i + INSERT_CHUNK)) });
    }
  }

  async insertMany(rows: NewRiskIndicator[], manager?: EntityManager): Promise<void> {
    const repository = this.getRepository(manager);
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      // details is free-form JSON, which TypeORM's insert type cannot express
      await repository.insert(
        rows.slice(i, i + INSERT_CHUNK) as QueryDeepPartialEntity<RiskIndicatorModel>[],
      );
    }
  }
}
