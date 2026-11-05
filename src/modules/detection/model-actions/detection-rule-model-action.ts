import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryDeepPartialEntity, Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { DEFAULT_RULES } from '../default-rules.js';
import { DetectionRuleModel } from '../models/detection-rule.model.js';

// Every query is scoped to one owner: accounts never see or use each
// other's rules
@Injectable()
export class DetectionRuleModelAction extends AbstractModel<DetectionRuleModel> {
  constructor(
    @InjectRepository(DetectionRuleModel)
    private readonly detectionRuleRepository: Repository<DetectionRuleModel>,
  ) {
    super(detectionRuleRepository, DetectionRuleModel);
  }

  // Gives an account the default rules the first time it needs rules. The
  // unique (owner, key, version) index makes two concurrent calls safe.
  async ensureDefaults(ownerId: string): Promise<void> {
    if (await this.detectionRuleRepository.exists({ where: { ownerId } })) return;
    await this.detectionRuleRepository
      .createQueryBuilder()
      .insert()
      .into(DetectionRuleModel)
      // params is free-form JSON, which TypeORM's insert type cannot express
      .values(DEFAULT_RULES.map((rule) => ({ ...rule, ownerId })) as QueryDeepPartialEntity<DetectionRuleModel>[])
      .orIgnore()
      .execute();
  }

  findActive(ownerId: string): Promise<DetectionRuleModel[]> {
    return this.detectionRuleRepository.find({
      where: { ownerId, isActive: true },
      order: { ruleKey: 'ASC' },
    });
  }

  // The latest version of every rule
  findLatest(ownerId: string): Promise<DetectionRuleModel[]> {
    return this.detectionRuleRepository
      .createQueryBuilder('r')
      .where('r.ownerId = :ownerId', { ownerId })
      .distinctOn(['r.ruleKey'])
      .orderBy('r.ruleKey')
      .addOrderBy('r.version', 'DESC')
      .getMany();
  }

  findLatestByKey(ownerId: string, ruleKey: string): Promise<DetectionRuleModel | null> {
    return this.detectionRuleRepository.findOne({ where: { ownerId, ruleKey }, order: { version: 'DESC' } });
  }

  findVersions(ownerId: string, ruleKey: string): Promise<DetectionRuleModel[]> {
    return this.detectionRuleRepository.find({ where: { ownerId, ruleKey }, order: { version: 'DESC' } });
  }

  async setActive(id: string, isActive: boolean, manager?: EntityManager): Promise<void> {
    await this.getRepository(manager).update(id, { isActive });
  }
}
