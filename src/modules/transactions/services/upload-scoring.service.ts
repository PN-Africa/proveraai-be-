import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DetectionService } from '../../detection/detection.service.js';
import type { ScoringTransaction } from '../../detection/services/rule-evaluator.service.js';
import { RiskIndicatorModelAction } from '../model-actions/risk-indicator-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { TransactionModel } from '../models/transaction.model.js';

// How far back a customer's history is searched
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

export interface ScoringCounts {
  scored: number;
  flagged: number;
}

// Scores transactions with the active rules and stores the results. Used by
// ingestion and by manual detection runs.
@Injectable()
export class UploadScoringService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly detectionService: DetectionService,
    private readonly transactionModelAction: TransactionModelAction,
    private readonly riskIndicatorModelAction: RiskIndicatorModelAction,
  ) {}

  // Returns how many were flagged
  async scoreUpload(uploadId: string): Promise<number> {
    const { flagged } = await this.score(await this.transactionModelAction.findForUpload(uploadId));
    return flagged;
  }

  // Each transaction is compared with the customer's history in the 90 days
  // before it, whichever upload it came in, so the result does not depend on
  // the order files were uploaded. Old indicators are replaced in the same
  // database transaction as the new scores.
  async score(transactions: TransactionModel[]): Promise<ScoringCounts> {
    const targets = transactions.map(toScoring);
    if (targets.length === 0) return { scored: 0, flagged: 0 };

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
        new Date(earliest - HISTORY_DAYS * DAY_MS),
        new Date(latest),
      )
    ).map(toScoring);

    const results = await this.detectionService.scoreBatch(targets, history);
    await this.dataSource.transaction(async (manager) => {
      await this.riskIndicatorModelAction.deleteForTransactions(
        targets.map((t) => t.id),
        manager,
      );
      await this.riskIndicatorModelAction.insertMany(
        results.flatMap((r) =>
          r.indicators.map((indicator) => ({ transactionId: r.id, ...indicator })),
        ),
        manager,
      );
      await this.transactionModelAction.saveRiskResults(results, manager);
    });
    return { scored: results.length, flagged: results.filter((r) => r.flagged).length };
  }
}
