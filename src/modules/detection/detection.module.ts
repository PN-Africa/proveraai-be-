import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DetectionService } from './detection.service.js';
import { DetectionRuleModelAction } from './model-actions/detection-rule-model-action.js';
import { DetectionRuleModel } from './models/detection-rule.model.js';
import { RiskScorerService } from './services/risk-scorer.service.js';
import { RuleEvaluatorService } from './services/rule-evaluator.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([DetectionRuleModel])],
  providers: [
    DetectionService,
    RuleEvaluatorService,
    RiskScorerService,
    DetectionRuleModelAction,
  ],
  exports: [DetectionService],
})
export class DetectionModule {}
