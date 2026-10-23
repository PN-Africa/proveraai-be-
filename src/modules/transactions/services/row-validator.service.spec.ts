import { RowValidatorService } from './row-validator.service.js';

const service = new RowValidatorService();
const validRow = {
  transactionId: 'TXN-1',
  amount: '50000.50',
  currency: 'ngn',
  timestamp: '2026-10-05T14:30:00Z',
  type: 'transfer',
};

const reasonsFor = (values: Record<string, string | undefined>) => {
  const result = service.validate(values);
  return result.valid ? [] : result.reasons;
};

describe('RowValidatorService', () => {
  it('accepts a row with only the required fields', () => {
    expect(service.validate(validRow)).toEqual({
      valid: true,
      row: {
        transactionId: 'TXN-1',
        amount: '50000.50',
        currency: 'NGN',
        occurredAt: new Date('2026-10-05T14:30:00Z'),
        type: 'TRANSFER',
        customerId: null,
        paymentMethod: null,
        location: null,
        attributes: {},
      },
    });
  });

  it('keeps the optional fields and extra columns', () => {
    const result = service.validate({
      ...validRow,
      customerId: 'CUST-1',
      paymentMethod: 'card',
      location: 'Lagos',
      channel: 'MOBILE',
    });
    expect(result).toMatchObject({
      valid: true,
      row: {
        customerId: 'CUST-1',
        paymentMethod: 'CARD',
        location: 'Lagos',
        attributes: { channel: 'MOBILE' },
      },
    });
  });

  it('lists every missing required field at once', () => {
    expect(reasonsFor({})).toEqual([
      'transactionId is required',
      'amount is required',
      'currency is required',
      'timestamp is required',
      'type is required',
    ]);
  });

  it.each([
    ['0', 'amount must be greater than 0'],
    ['-100', 'amount must be a number'],
    ['abc', 'amount must be a number'],
    ['50,000', 'amount must be a number'],
    ['₦500', 'amount must be a number'],
    ['10.123', 'amount must be a number'],
    ['2000000000000', 'amount must be at most'],
  ])('rejects amount %s', (amount, reason) => {
    expect(reasonsFor({ ...validRow, amount })[0]).toContain(reason);
  });

  it.each(['01/02/2026', '2026-13-45', 'yesterday'])('rejects date time %s', (timestamp) => {
    expect(reasonsFor({ ...validRow, timestamp })).toHaveLength(1);
  });

  it.each(['2026-02-30T10:00:00Z', '2026-02-29', '2026-04-31 09:00'])(
    'rejects the impossible date %s instead of rolling it over',
    (timestamp) => {
      expect(reasonsFor({ ...validRow, timestamp })).toEqual(['timestamp is not a real date']);
    },
  );

  it('rejects a date time in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(reasonsFor({ ...validRow, timestamp: future })).toEqual(['timestamp is in the future']);
  });

  it('reads a date time without an offset as UTC', () => {
    const result = service.validate({ ...validRow, timestamp: '2026-10-05 14:30' });
    expect(result.valid && result.row.occurredAt.toISOString()).toBe('2026-10-05T14:30:00.000Z');
  });

  it('respects an explicit offset', () => {
    const result = service.validate({ ...validRow, timestamp: '2026-10-05T14:30:00+01:00' });
    expect(result.valid && result.row.occurredAt.toISOString()).toBe('2026-10-05T13:30:00.000Z');
  });

  it.each(['=HYPERLINK("x")', '+1+1', '@SUM(A1)'])(
    'rejects spreadsheet formula %s in text and extra columns',
    (formula) => {
      expect(reasonsFor({ ...validRow, location: formula })).toHaveLength(1);
      expect(reasonsFor({ ...validRow, branch: formula })).toHaveLength(1);
    },
  );

  it('rejects text longer than its column allows', () => {
    expect(reasonsFor({ ...validRow, customerId: 'x'.repeat(101) })).toEqual([
      'customerId must be at most 100 characters',
    ]);
  });

  it('keeps the transactionId of a rejected row for the report', () => {
    const result = service.validate({ ...validRow, amount: 'bad' });
    expect(result.valid).toBe(false);
    expect(!result.valid && result.transactionId).toBe('TXN-1');
  });
});
