import { Injectable, Logger } from '@nestjs/common';
import { RuleType } from '../enums/rule-type.enum.js';
import { DetectionRuleModel } from '../models/detection-rule.model.js';

export interface ScoringTransaction {
  id: string;
  transactionId: string;
  amount: number;
  currency: string;
  occurredAt: Date;
  type: string;
  customerId: string | null;
  location: string | null;
  paymentMethod: string | null;
  attributes: Record<string, string>;
}

export interface FiredIndicator {
  ruleId: string;
  ruleKey: string;
  ruleName: string;
  weight: number;
  reason: string;
  details: Record<string, unknown>;
}

interface RuleHit {
  reason: string;
  details: Record<string, unknown>;
}

type Evaluate = (tx: ScoringTransaction, prior: ScoringTransaction[]) => RuleHit | null;

interface PreparedRule {
  rule: DetectionRuleModel;
  evaluate: Evaluate;
}

const MINUTE_MS = 60_000;
// Rules look back at most this many earlier transactions per customer
const MAX_PRIOR = 500;

const CUSTOMER_RULES = new Set([
  RuleType.AMOUNT_DEVIATION,
  RuleType.VELOCITY,
  RuleType.NEW_CONTEXT,
  RuleType.NEAR_DUPLICATE,
]);

// The parameters each rule type accepts
export const PARAM_KEYS: Record<RuleType, string[]> = {
  [RuleType.HIGH_AMOUNT]: ['threshold', 'currency'],
  [RuleType.AMOUNT_DEVIATION]: ['multiplier', 'minHistory', 'baselineSize'],
  [RuleType.VELOCITY]: ['windowMinutes', 'maxCount', 'maxTotal'],
  [RuleType.NEW_CONTEXT]: ['field', 'minHistory'],
  [RuleType.NEAR_DUPLICATE]: ['windowMinutes'],
  [RuleType.ODD_HOURS]: ['startHour', 'endHour', 'utcOffsetMinutes'],
};

const FIELD_LABELS: Record<string, string> = {
  location: 'location',
  paymentMethod: 'payment method',
  type: 'transaction type',
  currency: 'currency',
};

const money = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const fieldValue = (tx: ScoringTransaction, field: string): string | null => {
  if (field.startsWith('attributes.')) return tx.attributes[field.slice(11)] ?? null;
  const value = (tx as unknown as Record<string, unknown>)[field];
  return typeof value === 'string' && value !== '' ? value : null;
};

const optionalNumber = (params: Record<string, unknown>, key: string): number | undefined => {
  const value = params[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be a non-negative number`);
  }
  return value;
};

const positiveNumber = (params: Record<string, unknown>, key: string): number => {
  const value = optionalNumber(params, key);
  if (value === undefined) throw new Error(`${key} is required`);
  return value;
};

// Turns stored rules into evaluators and runs them against transactions
@Injectable()
export class RuleEvaluatorService {
  private readonly logger = new Logger(RuleEvaluatorService.name);

  // A rule with bad parameters is skipped (and logged), never allowed to stop scoring
  prepare(rules: DetectionRuleModel[]): PreparedRule[] {
    return rules.flatMap((rule) => {
      try {
        return [{ rule, evaluate: this.build(rule) }];
      } catch (err) {
        this.logger.error(
          `Skipping rule ${rule.ruleKey} v${rule.version}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return [];
      }
    });
  }

  // Throws a readable error if a rule of this type could not run with these
  // parameters. Used before saving a rule, so a bad edit never reaches scoring.
  validate(type: RuleType, params: Record<string, unknown>): void {
    const allowed = PARAM_KEYS[type];
    const unknown = Object.keys(params).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
      throw new Error(`Unknown parameters for ${type}: ${unknown.join(', ')}. Allowed: ${allowed.join(', ')}`);
    }
    this.build({ type, params } as DetectionRuleModel);
  }

  // targets are scored; history only provides context. Each transaction is
  // compared with the same customer's earlier transactions from both.
  evaluate(
    rules: PreparedRule[],
    targets: ScoringTransaction[],
    history: ScoringTransaction[],
  ): Map<string, FiredIndicator[]> {
    const timelines = new Map<string, ScoringTransaction[]>();
    const seen = new Set<string>();
    for (const tx of [...history, ...targets]) {
      if (!tx.customerId || seen.has(tx.id)) continue;
      seen.add(tx.id);
      const timeline = timelines.get(tx.customerId) ?? [];
      timeline.push(tx);
      timelines.set(tx.customerId, timeline);
    }
    const positions = new Map<string, number>();
    for (const timeline of timelines.values()) {
      timeline.sort(
        (a, b) =>
          a.occurredAt.getTime() - b.occurredAt.getTime() ||
          a.transactionId.localeCompare(b.transactionId),
      );
      timeline.forEach((tx, index) => positions.set(tx.id, index));
    }

    const results = new Map<string, FiredIndicator[]>();
    for (const tx of targets) {
      const timeline = tx.customerId ? timelines.get(tx.customerId) : undefined;
      const position = positions.get(tx.id) ?? 0;
      const prior = timeline ? timeline.slice(Math.max(0, position - MAX_PRIOR), position) : [];

      const fired: FiredIndicator[] = [];
      for (const { rule, evaluate } of rules) {
        if (CUSTOMER_RULES.has(rule.type) && !tx.customerId) continue;
        const hit = evaluate(tx, prior);
        if (hit) {
          fired.push({
            ruleId: rule.id,
            ruleKey: rule.ruleKey,
            ruleName: rule.name,
            weight: rule.weight,
            ...hit,
          });
        }
      }
      results.set(tx.id, fired);
    }
    return results;
  }

  private build(rule: DetectionRuleModel): Evaluate {
    const p = rule.params ?? {};
    switch (rule.type) {
      case RuleType.HIGH_AMOUNT:
        return this.highAmount(
          positiveNumber(p, 'threshold'),
          typeof p.currency === 'string' ? p.currency.toUpperCase() : undefined,
        );
      case RuleType.AMOUNT_DEVIATION:
        return this.amountDeviation(
          positiveNumber(p, 'multiplier'),
          positiveNumber(p, 'minHistory'),
          positiveNumber(p, 'baselineSize'),
        );
      case RuleType.VELOCITY: {
        const maxCount = optionalNumber(p, 'maxCount');
        const maxTotal = optionalNumber(p, 'maxTotal');
        if (maxCount === undefined && maxTotal === undefined) {
          throw new Error('maxCount or maxTotal is required');
        }
        return this.velocity(positiveNumber(p, 'windowMinutes'), maxCount, maxTotal);
      }
      case RuleType.NEW_CONTEXT: {
        const field = p.field;
        if (typeof field !== 'string' || !(field in FIELD_LABELS || field.startsWith('attributes.'))) {
          throw new Error('field must be location, paymentMethod, type, currency or attributes.<name>');
        }
        return this.newContext(field, positiveNumber(p, 'minHistory'));
      }
      case RuleType.NEAR_DUPLICATE:
        return this.nearDuplicate(positiveNumber(p, 'windowMinutes'));
      case RuleType.ODD_HOURS: {
        const startHour = positiveNumber(p, 'startHour');
        const endHour = positiveNumber(p, 'endHour');
        if (startHour > 24 || endHour > 24) throw new Error('startHour and endHour must be 0 to 24');
        const offset = p.utcOffsetMinutes ?? 0;
        if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < -720 || offset > 840) {
          throw new Error('utcOffsetMinutes must be a whole number from -720 to 840');
        }
        return this.oddHours(startHour, endHour, offset);
      }
      default:
        throw new Error(`unknown rule type ${String(rule.type)}`);
    }
  }

  // The reason never states the threshold, only the transaction (TR-11)
  private highAmount(threshold: number, currency?: string): Evaluate {
    return (tx) => {
      if (currency && tx.currency !== currency) return null;
      if (tx.amount < threshold) return null;
      return {
        reason: `High-value transaction of ${money(tx.amount, tx.currency)}`,
        details: { amount: tx.amount, currency: tx.currency },
      };
    };
  }

  private amountDeviation(multiplier: number, minHistory: number, baselineSize: number): Evaluate {
    return (tx, prior) => {
      const amounts = prior
        .filter((t) => t.currency === tx.currency)
        .slice(-baselineSize)
        .map((t) => t.amount);
      if (amounts.length < minHistory) return null;
      const usual = median(amounts);
      if (usual <= 0 || tx.amount < usual * multiplier) return null;
      const ratio = tx.amount / usual;
      return {
        reason: `Amount is ${ratio.toFixed(1)}× this customer's usual amount (median ${money(usual, tx.currency)} over ${amounts.length} transactions)`,
        details: { amount: tx.amount, median: usual, ratio: Number(ratio.toFixed(2)), basedOn: amounts.length },
      };
    };
  }

  private velocity(windowMinutes: number, maxCount?: number, maxTotal?: number): Evaluate {
    return (tx, prior) => {
      const since = tx.occurredAt.getTime() - windowMinutes * MINUTE_MS;
      const inWindow = [tx];
      for (let i = prior.length - 1; i >= 0 && prior[i].occurredAt.getTime() > since; i--) {
        inWindow.push(prior[i]);
      }
      const count = inWindow.length;
      const total = inWindow
        .filter((t) => t.currency === tx.currency)
        .reduce((sum, t) => sum + t.amount, 0);
      const countHit = maxCount !== undefined && count > maxCount;
      const totalHit = maxTotal !== undefined && total > maxTotal;
      if (!countHit && !totalHit) return null;
      const firstAt = inWindow[inWindow.length - 1].occurredAt.getTime();
      const minutes = Math.max(1, Math.round((tx.occurredAt.getTime() - firstAt) / MINUTE_MS));
      return {
        reason: `${count} transactions totalling ${money(total, tx.currency)} from this customer within ${minutes} minutes`,
        details: { count, total, minutes },
      };
    };
  }

  private newContext(field: string, minHistory: number): Evaluate {
    const label = FIELD_LABELS[field] ?? field.slice(11);
    return (tx, prior) => {
      const value = fieldValue(tx, field);
      if (!value) return null;
      const counts = new Map<string, number>();
      for (const t of prior) {
        const previous = fieldValue(t, field);
        if (previous) counts.set(previous.toLowerCase(), (counts.get(previous.toLowerCase()) ?? 0) + 1);
      }
      const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
      if (total < minHistory || counts.has(value.toLowerCase())) return null;
      const usual = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([v]) => prior.map((t) => fieldValue(t, field)).find((x) => x?.toLowerCase() === v) ?? v);
      return {
        reason: `New ${label} for this customer: ${value} (usually ${usual.join(', ')})`,
        details: { field, value, usual },
      };
    };
  }

  private nearDuplicate(windowMinutes: number): Evaluate {
    return (tx, prior) => {
      const since = tx.occurredAt.getTime() - windowMinutes * MINUTE_MS;
      for (let i = prior.length - 1; i >= 0 && prior[i].occurredAt.getTime() >= since; i--) {
        const earlier = prior[i];
        if (earlier.amount === tx.amount && earlier.currency === tx.currency) {
          const minutes = Math.round((tx.occurredAt.getTime() - earlier.occurredAt.getTime()) / MINUTE_MS);
          return {
            reason: `Same amount as transaction ${earlier.transactionId} from this customer ${minutes} minute${minutes === 1 ? '' : 's'} earlier`,
            details: { matchedTransactionId: earlier.transactionId, minutes },
          };
        }
      }
      return null;
    };
  }

  private oddHours(startHour: number, endHour: number, utcOffsetMinutes: number): Evaluate {
    return (tx) => {
      const local = new Date(tx.occurredAt.getTime() + utcOffsetMinutes * MINUTE_MS);
      const hour = local.getUTCHours();
      const inRange =
        startHour <= endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
      if (!inRange) return null;
      const time = local.toISOString().slice(11, 16);
      return {
        reason: `Made at ${time} local time, an unusual hour`,
        details: { localTime: time },
      };
    };
  }
}
