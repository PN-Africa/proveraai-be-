import { RuleType } from '../enums/rule-type.enum.js';
import { DetectionRuleModel } from '../models/detection-rule.model.js';
import { RuleEvaluatorService, ScoringTransaction } from './rule-evaluator.service.js';

const service = new RuleEvaluatorService();

const rule = (type: RuleType, params: Record<string, unknown>, weight = 10) =>
  ({ id: `rule-${type}`, ruleKey: type.toLowerCase(), version: 1, name: type, type, params, weight }) as DetectionRuleModel;

let seq = 0;
const tx = (overrides: Partial<ScoringTransaction> = {}): ScoringTransaction => {
  seq++;
  return {
    id: `id-${seq}`,
    transactionId: `TXN-${seq}`,
    amount: 50_000,
    currency: 'NGN',
    occurredAt: new Date('2026-10-01T10:00:00Z'),
    type: 'PAYMENT',
    customerId: 'CUST-1',
    location: 'Lagos',
    paymentMethod: 'CARD',
    attributes: {},
    ...overrides,
  };
};
const at = (minutesAfter: number) =>
  new Date(new Date('2026-10-01T10:00:00Z').getTime() + minutesAfter * 60_000);

// Fired indicators for one target given earlier history
const fire = (r: DetectionRuleModel, target: ScoringTransaction, history: ScoringTransaction[] = []) =>
  service.evaluate(service.prepare([r]), [target], history).get(target.id) ?? [];

describe('RuleEvaluatorService', () => {
  describe('HIGH_AMOUNT', () => {
    const highAmount = rule(RuleType.HIGH_AMOUNT, { threshold: 500_000, currency: 'NGN' }, 30);

    it('fires at or above the threshold, without revealing it', () => {
      const [hit] = fire(highAmount, tx({ amount: 950_000 }));
      expect(hit).toMatchObject({ weight: 30, reason: 'High-value transaction of NGN 950,000' });
      expect(hit.reason).not.toContain('500');
    });

    it('ignores smaller amounts and other currencies', () => {
      expect(fire(highAmount, tx({ amount: 499_999 }))).toEqual([]);
      expect(fire(highAmount, tx({ amount: 950_000, currency: 'USD' }))).toEqual([]);
    });

    it('works without a customer', () => {
      expect(fire(highAmount, tx({ amount: 950_000, customerId: null }))).toHaveLength(1);
    });
  });

  describe('AMOUNT_DEVIATION', () => {
    const deviation = rule(RuleType.AMOUNT_DEVIATION, { multiplier: 5, minHistory: 3, baselineSize: 50 });
    const history = [50_000, 52_000, 48_500].map((amount, i) => tx({ amount, occurredAt: at(-100 + i) }));

    it("fires when far above the customer's median, explaining by how much", () => {
      const [hit] = fire(deviation, tx({ amount: 950_000 }), history);
      expect(hit.reason).toBe(
        "Amount is 19.0× this customer's usual amount (median NGN 50,000 over 3 transactions)",
      );
    });

    it('stays quiet below the multiplier or with too little history', () => {
      expect(fire(deviation, tx({ amount: 200_000 }), history)).toEqual([]);
      expect(fire(deviation, tx({ amount: 950_000 }), history.slice(0, 2))).toEqual([]);
    });

    it('only compares with earlier transactions', () => {
      const later = [50_000, 52_000, 48_500].map((amount, i) => tx({ amount, occurredAt: at(100 + i) }));
      expect(fire(deviation, tx({ amount: 950_000 }), later)).toEqual([]);
    });

    it('needs a customer', () => {
      expect(fire(deviation, tx({ amount: 950_000, customerId: null }), history)).toEqual([]);
    });
  });

  describe('VELOCITY', () => {
    const velocity = rule(RuleType.VELOCITY, { windowMinutes: 10, maxCount: 4 });

    it('fires when the count in the window goes over the limit', () => {
      const history = [0, 2, 4, 5].map((m) => tx({ amount: 20_000, occurredAt: at(m) }));
      const [hit] = fire(velocity, tx({ amount: 20_000, occurredAt: at(7) }), history);
      expect(hit.reason).toBe('5 transactions totalling NGN 100,000 from this customer within 7 minutes');
    });

    it('ignores transactions outside the window', () => {
      const history = [-30, -20, 2, 4].map((m) => tx({ occurredAt: at(m) }));
      expect(fire(velocity, tx({ occurredAt: at(7) }), history)).toEqual([]);
    });

    it('can fire on total value instead of count', () => {
      const byValue = rule(RuleType.VELOCITY, { windowMinutes: 60, maxTotal: 1_000_000 });
      const history = [tx({ amount: 600_000, occurredAt: at(0) })];
      expect(fire(byValue, tx({ amount: 500_000, occurredAt: at(30) }), history)).toHaveLength(1);
    });
  });

  describe('NEW_CONTEXT', () => {
    const newLocation = rule(RuleType.NEW_CONTEXT, { field: 'location', minHistory: 3 });
    const history = [0, 1, 2].map((m) => tx({ occurredAt: at(-100 + m) }));

    it('fires on a value the customer has not used before', () => {
      const [hit] = fire(newLocation, tx({ location: 'Kano' }), history);
      expect(hit.reason).toBe('New location for this customer: Kano (usually Lagos)');
    });

    it('treats values case-insensitively and needs enough history', () => {
      expect(fire(newLocation, tx({ location: 'LAGOS' }), history)).toEqual([]);
      expect(fire(newLocation, tx({ location: 'Kano' }), history.slice(0, 2))).toEqual([]);
    });

    it('can watch an extra attribute such as channel', () => {
      const newChannel = rule(RuleType.NEW_CONTEXT, { field: 'attributes.channel', minHistory: 1 });
      const [hit] = fire(
        newChannel,
        tx({ attributes: { channel: 'USSD' } }),
        [tx({ attributes: { channel: 'MOBILE' }, occurredAt: at(-5) })],
      );
      expect(hit.reason).toBe('New channel for this customer: USSD (usually MOBILE)');
    });
  });

  describe('NEAR_DUPLICATE', () => {
    const nearDuplicate = rule(RuleType.NEAR_DUPLICATE, { windowMinutes: 10 });

    it('fires on the same amount shortly after another transaction', () => {
      const earlier = tx({ amount: 20_000, occurredAt: at(0) });
      const [hit] = fire(nearDuplicate, tx({ amount: 20_000, occurredAt: at(2) }), [earlier]);
      expect(hit.reason).toBe(`Same amount as transaction ${earlier.transactionId} from this customer 2 minutes earlier`);
    });

    it('ignores different amounts and older matches', () => {
      expect(fire(nearDuplicate, tx({ amount: 20_001, occurredAt: at(2) }), [tx({ amount: 20_000 })])).toEqual([]);
      expect(fire(nearDuplicate, tx({ amount: 20_000, occurredAt: at(30) }), [tx({ amount: 20_000 })])).toEqual([]);
    });
  });

  describe('ODD_HOURS', () => {
    const oddHours = rule(RuleType.ODD_HOURS, { startHour: 0, endHour: 5, utcOffsetMinutes: 60 });

    it('uses local time', () => {
      const [hit] = fire(oddHours, tx({ occurredAt: new Date('2026-10-03T03:12:00Z') }));
      expect(hit.reason).toBe('Made at 04:12 local time, an unusual hour');
      // 23:30 UTC is 00:30 local
      expect(fire(oddHours, tx({ occurredAt: new Date('2026-10-03T23:30:00Z') }))).toHaveLength(1);
      // 04:30 UTC is 05:30 local
      expect(fire(oddHours, tx({ occurredAt: new Date('2026-10-03T04:30:00Z') }))).toEqual([]);
    });

    it('supports windows that cross midnight', () => {
      const lateNight = rule(RuleType.ODD_HOURS, { startHour: 22, endHour: 4 });
      expect(fire(lateNight, tx({ occurredAt: new Date('2026-10-03T23:00:00Z') }))).toHaveLength(1);
      expect(fire(lateNight, tx({ occurredAt: new Date('2026-10-03T12:00:00Z') }))).toEqual([]);
    });
  });

  it('skips a rule with bad parameters instead of failing the batch', () => {
    const broken = rule(RuleType.HIGH_AMOUNT, { threshold: 'lots' });
    const working = rule(RuleType.ODD_HOURS, { startHour: 0, endHour: 24 });
    expect(service.prepare([broken, working]).map((p) => p.rule)).toEqual([working]);
  });

  it('validates parameters before a rule is saved', () => {
    expect(() => service.validate(RuleType.VELOCITY, { windowMinutes: 10, maxCount: 4 })).not.toThrow();
    expect(() => service.validate(RuleType.VELOCITY, { windowMinutes: 10 })).toThrow('maxCount or maxTotal is required');
    expect(() => service.validate(RuleType.ODD_HOURS, { startHour: 0, endHour: 25 })).toThrow('0 to 24');
    expect(() => service.validate(RuleType.ODD_HOURS, { startHour: 0, endHour: 5, utcOffsetMinutes: 1e6 })).toThrow(
      'utcOffsetMinutes',
    );
    expect(() => service.validate(RuleType.NEAR_DUPLICATE, { windowMinutes: 10, extra: 1 })).toThrow(
      'Unknown parameters for NEAR_DUPLICATE: extra',
    );
  });

  it('records which rule version fired', () => {
    const [hit] = fire(rule(RuleType.ODD_HOURS, { startHour: 0, endHour: 24 }, 15), tx());
    expect(hit).toMatchObject({ ruleId: 'rule-ODD_HOURS', ruleKey: 'odd_hours', weight: 15 });
  });
});
