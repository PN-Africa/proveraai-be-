import type { NewRejectedRow } from '../model-actions/rejected-row-model-action.js';
import { RejectedRowModelAction } from '../model-actions/rejected-row-model-action.js';
import type { NewTransaction } from '../model-actions/transaction-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { UploadBatchModelAction } from '../model-actions/upload-batch-model-action.js';
import { CsvReaderService } from './csv-reader.service.js';
import { IngestionService, MAX_STORED_REJECTIONS } from './ingestion.service.js';
import { RowValidatorService } from './row-validator.service.js';
import { UploadScoringService } from './upload-scoring.service.js';

const HEADER = 'transactionId,amount,currency,timestamp,type';
const row = (id: string, amount = '100') => `${id},${amount},NGN,2026-10-01T10:00:00Z,PAYMENT`;

const setup = ({
  alreadyStored = [] as string[],
  failInsert = false,
  failScoring = false,
  flagged = 0,
} = {}) => {
  const stored: NewTransaction[] = [];
  const rejected: NewRejectedRow[] = [];
  const uploadBatchModelAction = {
    markProcessing: vi.fn(async () => undefined),
    markCompleted: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
  };
  const transactionModelAction = {
    insertNew: vi.fn(async (rows: NewTransaction[]) => {
      if (failInsert) throw new Error('relation "transactions" does not exist');
      const fresh = rows.filter((r) => !alreadyStored.includes(r.transactionId));
      stored.push(...fresh);
      return fresh.map((r) => r.transactionId);
    }),
  };
  const rejectedRowModelAction = {
    insertMany: vi.fn(async (rows: NewRejectedRow[]) => {
      rejected.push(...rows);
    }),
  };
  const uploadScoringService = {
    scoreUpload: vi.fn(async () => {
      if (failScoring) throw new Error('rules table missing');
      return flagged;
    }),
  };
  const csvReaderService = new CsvReaderService();
  const service = new IngestionService(
    csvReaderService,
    new RowValidatorService(),
    uploadBatchModelAction as unknown as UploadBatchModelAction,
    transactionModelAction as unknown as TransactionModelAction,
    rejectedRowModelAction as unknown as RejectedRowModelAction,
    uploadScoringService as unknown as UploadScoringService,
  );
  const run = (lines: string[]) => {
    const file = Buffer.from([HEADER, ...lines].join('\n'));
    return service.process('upload-1', file, csvReaderService.readHeader(file));
  };
  return { run, stored, rejected, uploadBatchModelAction };
};

describe('IngestionService', () => {
  it('stores valid rows, records rejected ones and completes with counts', async () => {
    const { run, stored, rejected, uploadBatchModelAction } = setup();

    await run([row('T1'), row('T2', '-5'), row('T3')]);

    expect(stored.map((t) => t.transactionId)).toEqual(['T1', 'T3']);
    expect(stored[0].uploadId).toBe('upload-1');
    expect(rejected).toEqual([
      {
        uploadId: 'upload-1',
        rowNumber: 3,
        transactionId: 'T2',
        reasons: ['amount must be a number with at most 2 decimals, without commas or currency signs'],
      },
    ]);
    expect(uploadBatchModelAction.markCompleted).toHaveBeenCalledWith('upload-1', {
      totalRows: 3,
      acceptedRows: 2,
      rejectedRows: 1,
      flaggedRows: 0,
    });
  });

  it('rejects a transactionId repeated within the file', async () => {
    const { run, rejected } = setup();
    await run([row('T1'), row('T1')]);
    expect(rejected[0].reasons).toEqual(['transactionId appears more than once in this file']);
  });

  it('rejects a transactionId stored by an earlier upload', async () => {
    const { run, rejected, uploadBatchModelAction } = setup({ alreadyStored: ['T1'] });
    await run([row('T1'), row('T2')]);
    expect(rejected).toMatchObject([{ transactionId: 'T1', reasons: ['transactionId already exists'] }]);
    expect(uploadBatchModelAction.markCompleted).toHaveBeenCalledWith('upload-1', {
      totalRows: 2,
      acceptedRows: 1,
      rejectedRows: 1,
      flaggedRows: 0,
    });
  });

  it(`counts every rejection but stores only the first ${MAX_STORED_REJECTIONS}`, async () => {
    const { run, rejected, uploadBatchModelAction } = setup();
    const lines = Array.from({ length: MAX_STORED_REJECTIONS + 5 }, (_, i) => row(`T${i}`, 'bad'));
    await run(lines);
    expect(rejected).toHaveLength(MAX_STORED_REJECTIONS);
    expect(uploadBatchModelAction.markCompleted).toHaveBeenCalledWith(
      'upload-1',
      expect.objectContaining({ rejectedRows: MAX_STORED_REJECTIONS + 5 }),
    );
  });

  it('marks a malformed CSV as failed with a readable reason', async () => {
    const { run, uploadBatchModelAction } = setup();
    await run([row('T1'), 'T2,"unclosed quote']);
    const [, message] = uploadBatchModelAction.markFailed.mock.calls[0] as unknown as [string, string];
    expect(message).toMatch(/^The file could not be read: /);
  });

  it('hides internal errors from the uploader', async () => {
    const { run, uploadBatchModelAction } = setup({ failInsert: true });
    await run([row('T1')]);
    expect(uploadBatchModelAction.markFailed).toHaveBeenCalledWith(
      'upload-1',
      'Processing failed. Contact the team with the upload id.',
    );
  });

  it('scores the upload after storing it and records the flagged count', async () => {
    const { run, uploadBatchModelAction } = setup({ flagged: 2 });
    await run([row('T1'), row('T2')]);
    expect(uploadBatchModelAction.markCompleted).toHaveBeenCalledWith(
      'upload-1',
      expect.objectContaining({ acceptedRows: 2, flaggedRows: 2 }),
    );
  });

  it('says the rows were stored when only scoring fails', async () => {
    const { run, uploadBatchModelAction } = setup({ failScoring: true });
    await run([row('T1')]);
    expect(uploadBatchModelAction.markFailed).toHaveBeenCalledWith(
      'upload-1',
      'The transactions were stored, but risk scoring failed. Contact the team with the upload id.',
    );
  });
});
