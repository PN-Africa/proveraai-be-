import { Injectable } from '@nestjs/common';
import { RiskLevel } from '../enums/risk-level.enum.js';
import type { FiredIndicator } from './rule-evaluator.service.js';

// Score = sum of fired rule weights, capped at 100. No single default rule
// weighs enough to reach High alone, so High needs several signals (TR-11).
export const MEDIUM_FROM = 30;
export const HIGH_FROM = 70;
export const FLAG_FROM_LEVEL = RiskLevel.HIGH;

const RANK: Record<RiskLevel, number> = {
  [RiskLevel.LOW]: 0,
  [RiskLevel.MEDIUM]: 1,
  [RiskLevel.HIGH]: 2,
};

export interface RiskAssessment {
  riskScore: number;
  riskLevel: RiskLevel;
  flagged: boolean;
}

@Injectable()
export class RiskScorerService {
  score(indicators: FiredIndicator[]): RiskAssessment {
    const riskScore = Math.min(
      100,
      indicators.reduce((sum, indicator) => sum + indicator.weight, 0),
    );
    const riskLevel =
      riskScore >= HIGH_FROM
        ? RiskLevel.HIGH
        : riskScore >= MEDIUM_FROM
          ? RiskLevel.MEDIUM
          : RiskLevel.LOW;
    return { riskScore, riskLevel, flagged: RANK[riskLevel] >= RANK[FLAG_FROM_LEVEL] };
  }
}
