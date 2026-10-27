import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { DetectionRuleModel } from '../models/detection-rule.model.js';

@Injectable()
export class DetectionRuleModelAction extends AbstractModel<DetectionRuleModel> {
  constructor(
    @InjectRepository(DetectionRuleModel)
    private readonly detectionRuleRepository: Repository<DetectionRuleModel>,
  ) {
    super(detectionRuleRepository, DetectionRuleModel);
  }

  findActive(): Promise<DetectionRuleModel[]> {
    return this.detectionRuleRepository.find({
      where: { isActive: true },
      order: { ruleKey: 'ASC' },
    });
  }

  // The latest version of every rule
  findLatest(): Promise<DetectionRuleModel[]> {
    return this.detectionRuleRepository
      .createQueryBuilder('r')
      .distinctOn(['r.ruleKey'])
      .orderBy('r.ruleKey')
      .addOrderBy('r.version', 'DESC')
      .getMany();
  }

  findLatestByKey(ruleKey: string): Promise<DetectionRuleModel | null> {
    return this.detectionRuleRepository.findOne({ where: { ruleKey }, order: { version: 'DESC' } });
  }

  findVersions(ruleKey: string): Promise<DetectionRuleModel[]> {
    return this.detectionRuleRepository.find({ where: { ruleKey }, order: { version: 'DESC' } });
  }

  async setActive(id: string, isActive: boolean, manager?: EntityManager): Promise<void> {
    await this.getRepository(manager).update(id, { isActive });
  }
}
