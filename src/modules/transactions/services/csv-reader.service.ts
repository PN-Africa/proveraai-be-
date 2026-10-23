import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse';
import { parse as parseSync } from 'csv-parse/sync';
import { Readable } from 'node:stream';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_EXTRA_COLUMNS = 20;

export const REQUIRED_COLUMNS = [
  'transactionId',
  'amount',
  'currency',
  'timestamp',
  'type',
] as const;
export const OPTIONAL_COLUMNS = ['customerId', 'paymentMethod', 'location'] as const;
export type KnownColumn =
  | (typeof REQUIRED_COLUMNS)[number]
  | (typeof OPTIONAL_COLUMNS)[number];

// Header names are matched ignoring case, spaces, underscores and dashes,
// so "Transaction ID", "transaction_id" and "transactionId" all work
const HEADER_ALIASES: Partial<Record<string, KnownColumn>> = {
  transactionid: 'transactionId',
  amount: 'amount',
  currency: 'currency',
  timestamp: 'timestamp',
  datetime: 'timestamp',
  type: 'type',
  transactiontype: 'type',
  customerid: 'customerId',
  userid: 'customerId',
  location: 'location',
  paymentmethod: 'paymentMethod',
};

export interface UploadedCsvFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface CsvRecord {
  rowNumber: number;
  values: Record<string, string | undefined>;
}

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/[\s_-]/g, '');

// Reads the uploaded CSV: checks the header row, then streams the data rows
@Injectable()
export class CsvReaderService {
  // Maps the header row to column keys: known columns get their canonical
  // name, anything else keeps its own header and ends up in attributes.
  // Throws 400 when the file cannot be used at all.
  readHeader(file: Buffer): string[] {
    let header: string[];
    try {
      const [firstRow] = parseSync(file, { bom: true, to_line: 1, trim: true }) as string[][];
      header = firstRow ?? [];
    } catch {
      throw new BadRequestException('The file is not a readable CSV');
    }
    if (header.length === 0) throw new BadRequestException('The file is empty');

    const columns: string[] = header.map(
      (name) => HEADER_ALIASES[normalizeHeader(name)] ?? name,
    );
    const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
    }
    const duplicates = columns.filter((c, i) => columns.indexOf(c) !== i);
    if (duplicates.length > 0) {
      throw new BadRequestException(`Duplicate columns: ${[...new Set(duplicates)].join(', ')}`);
    }
    const known: string[] = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
    const extras = columns.filter((c) => !known.includes(c));
    if (extras.length > MAX_EXTRA_COLUMNS) {
      throw new BadRequestException(`At most ${MAX_EXTRA_COLUMNS} extra columns are allowed`);
    }
    if (extras.some((c) => c === '' || c.length > 50)) {
      throw new BadRequestException('Every column needs a name of at most 50 characters');
    }
    return columns;
  }

  async *records(file: Buffer, columns: string[]): AsyncGenerator<CsvRecord> {
    const parser = Readable.from(file).pipe(
      parse({
        bom: true,
        columns,
        from_line: 2,
        info: true,
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true,
        max_record_size: 10_000,
      }),
    );
    for await (const { record, info } of parser as AsyncIterable<{
      record: Record<string, string | undefined>;
      info: { lines: number };
    }>) {
      yield { rowNumber: info.lines, values: record };
    }
  }
}
