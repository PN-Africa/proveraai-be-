import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../audit/enums/audit-action.enum.js';
import { DateRangeQueryDto } from '../dtos/date-range-query.dto.js';
import { RiskIndicatorModelAction } from '../model-actions/risk-indicator-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { reviewStatusOf } from './transaction-view.service.js';

export const MAX_EXPORT_ROWS = 10_000;

const COLUMNS = [
  'transactionId',
  'occurredAt',
  'amount',
  'currency',
  'type',
  'paymentMethod',
  'location',
  'riskScore',
  'riskLevel',
  'flagged',
  'reviewStatus',
  'decision',
  'reasons',
] as const;

// Quotes every cell, and stops spreadsheet apps from running a cell as a
// formula by prefixing it with an apostrophe (OWASP CSV injection)
export const toCsvCell = (value: string | number | boolean | null | undefined): string => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export interface CsvExport {
  fileName: string;
  content: Buffer;
}

// A flagged transaction's customer, with every transaction of theirs in the
// user's own data and the reasons behind each risk level, as a CSV file for
// offline investigation.
@Injectable()
export class CustomerHistoryExportService {
  private readonly logger = new Logger(CustomerHistoryExportService.name);

  constructor(
    private readonly transactionModelAction: TransactionModelAction,
    private readonly riskIndicatorModelAction: RiskIndicatorModelAction,
    private readonly auditService: AuditService,
  ) {}

  async export(transactionId: string, range: DateRangeQueryDto, user: AuthUser): Promise<CsvExport> {
    const flaggedTransaction = await this.transactionModelAction.findOne({
      where: { id: transactionId, ownerId: user.id },
    });
    if (!flaggedTransaction) throw new NotFoundException('Transaction not found');
    if (!flaggedTransaction.flagged) {
      throw new BadRequestException('Customer history is available for flagged transactions only');
    }
    const { customerId } = flaggedTransaction;
    if (!customerId) throw new BadRequestException('This transaction has no customer ID');

    const transactions = await this.transactionModelAction.findCustomerTransactions(
      user.id,
      customerId,
      range.from ? new Date(range.from) : undefined,
      range.to ? new Date(range.to) : undefined,
      MAX_EXPORT_ROWS + 1,
    );
    if (transactions.length > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `This customer has more than ${MAX_EXPORT_ROWS} transactions. Narrow the range with from and to`,
      );
    }

    const reasons = new Map<string, string[]>();
    for (const indicator of await this.riskIndicatorModelAction.findForTransactions(
      transactions.map((t) => t.id),
    )) {
      reasons.set(indicator.transactionId, [...(reasons.get(indicator.transactionId) ?? []), indicator.reason]);
    }

    const rows = transactions.map((t) =>
      [
        t.transactionId,
        t.occurredAt.toISOString(),
        t.amount,
        t.currency,
        t.type,
        t.paymentMethod,
        t.location,
        t.riskScore,
        t.riskLevel,
        t.flagged,
        reviewStatusOf(t),
        t.review?.decision,
        (reasons.get(t.id) ?? []).join('; '),
      ]
        .map(toCsvCell)
        .join(','),
    );

    this.logger.log(
      `Customer history exported: transaction=${transactionId} rows=${rows.length} by=${user.id}`,
    );
    await this.auditService.record({
      action: AuditAction.CUSTOMER_HISTORY_EXPORTED,
      entityType: 'transaction',
      entityId: transactionId,
      metadata: { customerId, rows: rows.length, from: range.from ?? null, to: range.to ?? null },
    });
    return {
      fileName: `customer-${customerId.replace(/[^A-Za-z0-9_-]/g, '_')}-transactions.csv`,
      content: Buffer.from([COLUMNS.join(','), ...rows].join('\r\n') + '\r\n', 'utf8'),
    };
  }
}
