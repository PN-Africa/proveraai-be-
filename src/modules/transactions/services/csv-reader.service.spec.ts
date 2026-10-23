import { BadRequestException } from '@nestjs/common';
import { CsvReaderService } from './csv-reader.service.js';

const service = new CsvReaderService();
const csv = (text: string) => Buffer.from(text, 'utf8');
const HEADER = 'transactionId,amount,currency,timestamp,type';

const collect = async (file: Buffer) => {
  const columns = service.readHeader(file);
  const rows = [];
  for await (const record of service.records(file, columns)) rows.push(record);
  return rows;
};

describe('CsvReaderService', () => {
  describe('readHeader', () => {
    it('maps header variants to the known column names', () => {
      const columns = service.readHeader(
        csv(
          'transaction_id,AMOUNT,Currency,date time,Transaction Type,customer-id,Payment Method,Location,channel\n',
        ),
      );
      expect(columns).toEqual([
        'transactionId',
        'amount',
        'currency',
        'timestamp',
        'type',
        'customerId',
        'paymentMethod',
        'location',
        'channel',
      ]);
    });

    it('accepts a file with only the required columns', () => {
      expect(service.readHeader(csv(`${HEADER}\n`))).toHaveLength(5);
    });

    it('ignores a UTF-8 byte order mark', () => {
      expect(service.readHeader(csv(`﻿${HEADER}\n`))[0]).toBe('transactionId');
    });

    it('rejects a file missing required columns', () => {
      expect(() => service.readHeader(csv('transactionId,amount,type\n'))).toThrow(
        'Missing required columns: currency, timestamp',
      );
    });

    it('rejects duplicate columns', () => {
      expect(() => service.readHeader(csv(`${HEADER},amount\n`))).toThrow(BadRequestException);
    });

    it('rejects an empty file', () => {
      expect(() => service.readHeader(csv(''))).toThrow(BadRequestException);
    });

    it('rejects more than 20 extra columns', () => {
      const extras = Array.from({ length: 21 }, (_, i) => `extra${i}`).join(',');
      expect(() => service.readHeader(csv(`${HEADER},${extras}\n`))).toThrow(BadRequestException);
    });
  });

  describe('records', () => {
    it('yields each data row with its line number, skipping blank lines', async () => {
      const rows = await collect(
        csv(`${HEADER}\nT1,100,NGN,2026-10-01,PAYMENT\n\nT2,200,NGN,2026-10-02,PAYMENT\n`),
      );
      expect(rows).toEqual([
        {
          rowNumber: 2,
          values: { transactionId: 'T1', amount: '100', currency: 'NGN', timestamp: '2026-10-01', type: 'PAYMENT' },
        },
        {
          rowNumber: 4,
          values: { transactionId: 'T2', amount: '200', currency: 'NGN', timestamp: '2026-10-02', type: 'PAYMENT' },
        },
      ]);
    });
  });
});
