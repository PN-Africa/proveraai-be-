import { Injectable } from '@nestjs/common';
import { DetectionService } from '../../detection/detection.service.js';
import type { ScoringTransaction } from '../../detection/services/rule-evaluator.service.js';
import { RiskIndicatorModelAction } from '../model-actions/risk-indicator-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { TransactionModel } from '../models/transaction.model.js';

// How far back other uploads are searched for a customer's history
const HISTORY_DAYS = 90;
const DAY_MS = 86_400_000;

const toScoring = (t: TransactionModel): ScoringTransaction => ({
  id: t.id,
  transactionId: t.transactionId,
  amount: Number(t.amount),
  currency: t.currency,
  occurredAt: t.occurredAt,
  type: t.type,
  customerId: t.customerId,
  location: t.location,
  paymentMethod: t.paymentMethod,
  attributes: t.attributes ?? {},
});

// Scores every transaction of an upload and stores the results.
// Returns how many were flagged.
@Injectable()
export class UploadScoringService {
  constructor(
    private readonly detectionService: DetectionService,
    private readonly transactionModelAction: TransactionModelAction,
    private readonly riskIndicatorModelAction: RiskIndicatorModelAction,
  ) {}

  async scoreUpload(uploadId: string): Promise<number> {
    const targets = (await this.transactionModelAction.findForUpload(uploadId)).map(toScoring);
    if (targets.length === 0) return 0;

    const customerIds = [...new Set(targets.flatMap((t) => (t.customerId ? [t.customerId] : [])))];
    let earliest = Infinity;
    let latest = -Infinity;
    for (const { occurredAt } of targets) {
      earliest = Math.min(earliest, occurredAt.getTime());
      latest = Math.max(latest, occurredAt.getTime());
    }
    const history = (
      await this.transactionModelAction.findCustomerHistory(
        customerIds,
        uploadId,
        new Date(earliest - HISTORY_DAYS * DAY_MS),
        new Date(latest),
      )
    ).map(toScoring);

    const results = await this.detectionService.scoreBatch(targets, history);
    await this.riskIndicatorModelAction.insertMany(
      results.flatMap((r) =>
        r.indicators.map((indicator) => ({ transactionId: r.id, ...indicator })),
      ),
    );
    await this.transactionModelAction.saveRiskResults(results);
    return results.filter((r) => r.flagged).length;
  }
}
