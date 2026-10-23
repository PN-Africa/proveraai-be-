import { Injectable } from '@nestjs/common';
import type { NewTransaction } from '../model-actions/transaction-model-action.js';
import { OPTIONAL_COLUMNS, REQUIRED_COLUMNS } from './csv-reader.service.js';

export type ValidatedRow = Omit<NewTransaction, 'uploadId'>;

export type RowValidation =
  | { valid: true; row: ValidatedRow }
  | { valid: false; transactionId: string | null; reasons: string[] };

const MAX_AMOUNT = 1_000_000_000_000;
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/;
const FUTURE_TOLERANCE_MS = 5 * 60_000;
// Cells starting with these run as formulas when the data is opened in a
// spreadsheet later, so they are refused at the door
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const MAX_ATTRIBUTE_LENGTH = 200;

const KNOWN_COLUMNS: readonly string[] = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

// Checks one CSV row and turns it into a transaction, or lists every reason
// it was rejected. Never fixes a bad value silently (TR-18).
@Injectable()
export class RowValidatorService {
  validate(values: Record<string, string | undefined>): RowValidation {
    const reasons: string[] = [];

    const transactionId = this.text(values, 'transactionId', 100, true, reasons);
    const amount = this.amount(values.amount, reasons);
    const currency = this.text(values, 'currency', 10, true, reasons)?.toUpperCase();
    const occurredAt = this.timestamp(values.timestamp, reasons);
    const type = this.text(values, 'type', 50, true, reasons)?.toUpperCase();
    const customerId = this.text(values, 'customerId', 100, false, reasons);
    const paymentMethod = this.text(values, 'paymentMethod', 50, false, reasons)?.toUpperCase();
    const location = this.text(values, 'location', 100, false, reasons);
    const attributes = this.attributes(values, reasons);

    if (reasons.length > 0 || !transactionId || !amount || !currency || !occurredAt || !type) {
      return { valid: false, transactionId: transactionId ?? null, reasons };
    }
    return {
      valid: true,
      row: {
        transactionId,
        amount,
        currency,
        occurredAt,
        type,
        customerId: customerId ?? null,
        paymentMethod: paymentMethod ?? null,
        location: location ?? null,
        attributes,
      },
    };
  }

  private text(
    values: Record<string, string | undefined>,
    column: string,
    maxLength: number,
    required: boolean,
    reasons: string[],
  ): string | undefined {
    const value = values[column]?.trim();
    if (!value) {
      if (required) reasons.push(`${column} is required`);
      return undefined;
    }
    if (value.length > maxLength) {
      reasons.push(`${column} must be at most ${maxLength} characters`);
    } else if (FORMULA_PREFIX.test(value)) {
      reasons.push(`${column} must not start with =, +, - or @`);
    }
    return value;
  }

  private amount(raw: string | undefined, reasons: string[]): string | undefined {
    const value = raw?.trim();
    if (!value) {
      reasons.push('amount is required');
      return undefined;
    }
    if (!AMOUNT.test(value)) {
      reasons.push('amount must be a number with at most 2 decimals, without commas or currency signs');
      return undefined;
    }
    const numeric = Number(value);
    if (numeric <= 0) {
      reasons.push('amount must be greater than 0');
      return undefined;
    }
    if (numeric > MAX_AMOUNT) {
      reasons.push(`amount must be at most ${MAX_AMOUNT}`);
      return undefined;
    }
    return value;
  }

  // ISO 8601 only (2026-10-05, 2026-10-05 14:30, 2026-10-05T14:30:00+01:00),
  // so dates like 01/02/2026 are never misread. No offset means UTC.
  private timestamp(raw: string | undefined, reasons: string[]): Date | undefined {
    const value = raw?.trim();
    if (!value) {
      reasons.push('timestamp is required');
      return undefined;
    }
    if (!ISO_DATE.test(value)) {
      reasons.push('timestamp must be ISO 8601, e.g. 2026-10-05T14:30:00Z');
      return undefined;
    }
    // JavaScript rolls impossible days over (Feb 30 becomes Mar 2), so check
    // the calendar date itself
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const calendarDay = new Date(Date.UTC(year, month - 1, day));
    if (calendarDay.getUTCMonth() !== month - 1 || calendarDay.getUTCDate() !== day) {
      reasons.push('timestamp is not a real date');
      return undefined;
    }
    const hasTime = value.length > 10;
    const iso = !hasTime
      ? `${value}T00:00:00Z`
      : `${value.replace(' ', 'T')}${HAS_OFFSET.test(value) ? '' : 'Z'}`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      reasons.push('timestamp is not a real date');
      return undefined;
    }
    if (date.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
      reasons.push('timestamp is in the future');
      return undefined;
    }
    return date;
  }

  private attributes(
    values: Record<string, string | undefined>,
    reasons: string[],
  ): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (const [column, raw] of Object.entries(values)) {
      if (KNOWN_COLUMNS.includes(column)) continue;
      const value = raw?.trim();
      if (!value) continue;
      if (value.length > MAX_ATTRIBUTE_LENGTH) {
        reasons.push(`${column} must be at most ${MAX_ATTRIBUTE_LENGTH} characters`);
      } else if (FORMULA_PREFIX.test(value)) {
        reasons.push(`${column} must not start with =, +, - or @`);
      } else {
        attributes[column] = value;
      }
    }
    return attributes;
  }
}
