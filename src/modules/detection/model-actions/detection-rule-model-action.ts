import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
