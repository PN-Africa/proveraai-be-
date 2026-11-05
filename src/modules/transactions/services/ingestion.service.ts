import { Injectable, Logger } from '@nestjs/common';
import { CsvError } from 'csv-parse';
import {
  NewRejectedRow,
  RejectedRowModelAction,
} from '../model-actions/rejected-row-model-action.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import {
  UploadBatchModelAction,
  UploadCounts,
} from '../model-actions/upload-batch-model-action.js';
import { CsvReaderService } from './csv-reader.service.js';
import { RowValidatorService, ValidatedRow } from './row-validator.service.js';
import { UploadScoringService } from './upload-scoring.service.js';

const CHUNK_SIZE = 500;
// Every rejection is counted, but only this many are stored with reasons
export const MAX_STORED_REJECTIONS = 1000;

interface PendingRow {
  rowNumber: number;
  row: ValidatedRow;
}

// Processes one upload in the background: validates every row, stores the
// valid ones in chunks, records the rejected ones, scores the stored ones,
// and sets the final status
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly csvReaderService: CsvReaderService,
    private readonly rowValidatorService: RowValidatorService,
    private readonly uploadBatchModelAction: UploadBatchModelAction,
    private readonly transactionModelAction: TransactionModelAction,
    private readonly rejectedRowModelAction: RejectedRowModelAction,
    private readonly uploadScoringService: UploadScoringService,
  ) {}

  async process(uploadId: string, ownerId: string, file: Buffer, columns: string[]): Promise<void> {
    // Set once the rows are stored, so a scoring failure keeps the counts
    let counts: UploadCounts | undefined;
    try {
      await this.uploadBatchModelAction.markProcessing(uploadId);
      counts = await this.ingest(uploadId, ownerId, file, columns);
      counts.flaggedRows = await this.uploadScoringService.scoreUpload(uploadId);
      await this.uploadBatchModelAction.markCompleted(uploadId, counts);
      this.logger.log(
        `Upload ${uploadId} completed: ${counts.acceptedRows} accepted, ${counts.rejectedRows} rejected, ${counts.flaggedRows} flagged`,
      );
    } catch (err) {
      this.logger.error(
        `Upload ${uploadId} failed: ${err instanceof Error ? err.stack : String(err)}`,
      );
      // CSV errors describe the file and help the uploader; anything else
      // could expose internals, so the uploader gets a generic message
      const message =
        err instanceof CsvError
          ? `The file could not be read: ${err.message}`
          : counts
            ? 'The transactions were stored, but risk scoring failed. An admin can rescore this upload.'
            : 'Processing failed. Contact the team with the upload id.';
      await this.uploadBatchModelAction
        .markFailed(uploadId, message, counts)
        .catch((markErr: unknown) =>
          this.logger.error(`Could not mark upload ${uploadId} as failed: ${String(markErr)}`),
        );
    }
  }

  private async ingest(
    uploadId: string,
    ownerId: string,
    file: Buffer,
    columns: string[],
  ): Promise<UploadCounts> {
    const counts: UploadCounts = { totalRows: 0, acceptedRows: 0, rejectedRows: 0, flaggedRows: 0 };
    const seenInFile = new Set<string>();
    let pending: PendingRow[] = [];
    let rejections: NewRejectedRow[] = [];
    let storedRejections = 0;

    const reject = (rowNumber: number, transactionId: string | null, reasons: string[]) => {
      counts.rejectedRows++;
      if (storedRejections < MAX_STORED_REJECTIONS) {
        storedRejections++;
        rejections.push({ uploadId, rowNumber, transactionId, reasons });
      }
    };

    const flushTransactions = async () => {
      const inserted = new Set(
        await this.transactionModelAction.insertNew(
          pending.map(({ row }) => ({ ...row, uploadId, ownerId })),
        ),
      );
      for (const { rowNumber, row } of pending) {
        if (inserted.has(row.transactionId)) counts.acceptedRows++;
        else reject(rowNumber, row.transactionId, ['transactionId already exists']);
      }
      pending = [];
    };

    const flushRejections = async () => {
      await this.rejectedRowModelAction.insertMany(rejections);
      rejections = [];
    };

    for await (const { rowNumber, values } of this.csvReaderService.records(file, columns)) {
      counts.totalRows++;
      const result = this.rowValidatorService.validate(values);
      if (!result.valid) {
        reject(rowNumber, result.transactionId, result.reasons);
      } else if (seenInFile.has(result.row.transactionId)) {
        reject(rowNumber, result.row.transactionId, [
          'transactionId appears more than once in this file',
        ]);
      } else {
        seenInFile.add(result.row.transactionId);
        pending.push({ rowNumber, row: result.row });
      }

      if (pending.length >= CHUNK_SIZE) await flushTransactions();
      if (rejections.length >= CHUNK_SIZE) await flushRejections();
    }
    await flushTransactions();
    await flushRejections();
    return counts;
  }
}
