import { RiskLevel } from '../enums/risk-level.enum.js';
import { RiskScorerService } from './risk-scorer.service.js';
import type { FiredIndicator } from './rule-evaluator.service.js';

const service = new RiskScorerService();
const fired = (...weights: number[]) =>
  weights.map((weight) => ({ weight }) as FiredIndicator);

describe('RiskScorerService', () => {
  it.each([
    [[], 0, RiskLevel.LOW, false],
    [[15, 10], 25, RiskLevel.LOW, false],
    [[30], 30, RiskLevel.MEDIUM, false],
    [[30, 20, 15], 65, RiskLevel.MEDIUM, false],
    [[35, 35], 70, RiskLevel.HIGH, true],
    [[30, 35, 15, 15, 10], 100, RiskLevel.HIGH, true],
  ])('weights %j score %i (%s, flagged %s)', (weights, score, level, flagged) => {
    expect(service.score(fired(...weights))).toEqual({
      riskScore: score,
      riskLevel: level,
      flagged,
    });
  });
});
