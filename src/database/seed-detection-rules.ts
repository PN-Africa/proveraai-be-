import { Logger } from '@nestjs/common';
import { RuleType } from '../modules/detection/enums/rule-type.enum.js';
import { DetectionRuleModel } from '../modules/detection/models/detection-rule.model.js';
import { dataSource } from './data-source.js';

// Starting thresholds and weights for the MVP, to be reviewed by the data
// analyst. Seeded only while the rules table is empty.
export const DEFAULT_RULES: Pick<DetectionRuleModel, 'ruleKey' | 'name' | 'type' | 'params' | 'weight'>[] = [
  {
    ruleKey: 'high-amount-ngn',
    name: 'High-value transaction (NGN)',
    type: RuleType.HIGH_AMOUNT,
    params: { threshold: 500_000, currency: 'NGN' },
    weight: 30,
  },
  {
    ruleKey: 'amount-deviation',
    name: "Amount far above the customer's usual",
    type: RuleType.AMOUNT_DEVIATION,
    params: { multiplier: 5, minHistory: 3, baselineSize: 50 },
    weight: 35,
  },
  {
    ruleKey: 'velocity',
    name: 'Many transactions in a short time',
    type: RuleType.VELOCITY,
    params: { windowMinutes: 10, maxCount: 4 },
    weight: 30,
  },
  {
    ruleKey: 'new-location',
    name: 'New location for the customer',
    type: RuleType.NEW_CONTEXT,
    params: { field: 'location', minHistory: 3 },
    weight: 15,
  },
  {
    ruleKey: 'new-payment-method',
    name: 'New payment method for the customer',
    type: RuleType.NEW_CONTEXT,
    params: { field: 'paymentMethod', minHistory: 3 },
    weight: 10,
  },
  {
    ruleKey: 'near-duplicate',
    name: 'Same amount repeated in a short time',
    type: RuleType.NEAR_DUPLICATE,
    params: { windowMinutes: 10 },
    weight: 20,
  },
  {
    ruleKey: 'odd-hours',
    name: 'Unusual time of day',
    type: RuleType.ODD_HOURS,
    params: { startHour: 0, endHour: 5, utcOffsetMinutes: 60 },
    weight: 15,
  },
];

export const seedDetectionRules = async () => {
  const logger = new Logger('SeedDetectionRules');
  const ruleRepo = dataSource.getRepository(DetectionRuleModel);

  if (await ruleRepo.exists()) return;

  await ruleRepo.save(ruleRepo.create(DEFAULT_RULES));
  logger.log(`Seeded ${DEFAULT_RULES.length} detection rules`);
};
