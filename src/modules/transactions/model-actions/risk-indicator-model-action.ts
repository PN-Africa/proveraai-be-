import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryDeepPartialEntity, Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { RiskIndicatorModel } from '../models/risk-indicator.model.js';

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

  async insertMany(rows: NewRiskIndicator[]): Promise<void> {
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      // details is free-form JSON, which TypeORM's insert type cannot express
      await this.riskIndicatorRepository.insert(
        rows.slice(i, i + INSERT_CHUNK) as QueryDeepPartialEntity<RiskIndicatorModel>[],
      );
    }
  }
}
