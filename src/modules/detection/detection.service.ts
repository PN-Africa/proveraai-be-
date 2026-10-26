import { Injectable } from '@nestjs/common';
import { DetectionRuleModelAction } from './model-actions/detection-rule-model-action.js';
import { RiskAssessment, RiskScorerService } from './services/risk-scorer.service.js';
import {
  FiredIndicator,
  RuleEvaluatorService,
  ScoringTransaction,
} from './services/rule-evaluator.service.js';

export interface ScoringResult extends RiskAssessment {
  id: string;
  indicators: FiredIndicator[];
}

// Exported to the transactions module. Pure engine: it never reads or
// writes transactions, it only scores what it is given.
@Injectable()
export class DetectionService {
  constructor(
    private readonly detectionRuleModelAction: DetectionRuleModelAction,
    private readonly ruleEvaluatorService: RuleEvaluatorService,
    private readonly riskScorerService: RiskScorerService,
  ) {}

  async scoreBatch(
    targets: ScoringTransaction[],
    history: ScoringTransaction[],
  ): Promise<ScoringResult[]> {
    const rules = this.ruleEvaluatorService.prepare(
      await this.detectionRuleModelAction.findActive(),
    );
    const fired = this.ruleEvaluatorService.evaluate(rules, targets, history);
    return targets.map((tx) => {
      const indicators = fired.get(tx.id) ?? [];
      return { id: tx.id, indicators, ...this.riskScorerService.score(indicators) };
    });
  }
}
