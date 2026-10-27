import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { REDIS_CLIENT } from '../../../common/redis/redis.constants.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../audit/enums/audit-action.enum.js';
import { UploadStatus } from '../enums/upload-status.enum.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { UploadBatchModelAction } from '../model-actions/upload-batch-model-action.js';
import { TransactionModel } from '../models/transaction.model.js';
import { UploadBatchModel } from '../models/upload-batch.model.js';
import { UploadScoringService } from './upload-scoring.service.js';

// One manual run at a time, so two runs never write the same transactions.
// The lock expires on its own if the process dies mid-run.
const LOCK_KEY = 'detection:manual-run';
const LOCK_SECONDS = 15 * 60;
const RELEASE_IF_OWNER =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export interface RunResult {
  uploads: number;
  scored: number;
  flagged: number;
  // Claimed or reviewed transactions keep their score
  skippedReviewed: number;
}

// Admin-triggered detection with the current active rules. Rule changes never
// rescore anything on their own (R-02); an admin decides when.
@Injectable()
export class DetectionRunService {
  private readonly logger = new Logger(DetectionRunService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly uploadScoringService: UploadScoringService,
    private readonly transactionModelAction: TransactionModelAction,
    private readonly uploadBatchModelAction: UploadBatchModelAction,
    private readonly auditService: AuditService,
  ) {}

  // Rescores every transaction of one upload that is not claimed or reviewed
  rescoreUpload(uploadId: string, admin: AuthUser): Promise<RunResult> {
    return this.withLock(async () => {
      const upload = await this.uploadBatchModelAction.findById(uploadId);
      if (!upload) throw new NotFoundException('Upload not found');
      if (upload.status === UploadStatus.PENDING || upload.status === UploadStatus.PROCESSING) {
        throw new ConflictException('This upload is still being processed');
      }
      const stored = await this.transactionModelAction.countForUpload(uploadId);
      if (stored === 0) throw new ConflictException('This upload has no stored transactions');

      const targets = await this.transactionModelAction.findUnreviewedForUpload(uploadId);
      const counts = await this.scoreUpload(upload, targets, stored);
      const result = { uploads: 1, ...counts, skippedReviewed: stored - targets.length };
      this.logger.log(`Upload ${uploadId} rescored by=${admin.id}: ${JSON.stringify(result)}`);
      await this.auditService.record({
        action: AuditAction.UPLOAD_RESCORED,
        entityType: 'upload',
        entityId: uploadId,
        metadata: { ...result },
      });
      return result;
    });
  }

  // Scores transactions that have no score yet: data stored before detection
  // existed, or uploads where scoring failed. Upload by upload, to bound memory.
  scoreUnscored(admin: AuthUser): Promise<RunResult> {
    return this.withLock(async () => {
      const result: RunResult = { uploads: 0, scored: 0, flagged: 0, skippedReviewed: 0 };
      for (const uploadId of await this.transactionModelAction.findUploadIdsWithUnscored()) {
        const upload = await this.uploadBatchModelAction.findById(uploadId);
        if (!upload) continue;
        const targets = await this.transactionModelAction.findUnscoredForUpload(uploadId);
        const stored = await this.transactionModelAction.countForUpload(uploadId);
        const counts = await this.scoreUpload(upload, targets, stored);
        result.uploads++;
        result.scored += counts.scored;
        result.flagged += counts.flagged;
      }
      this.logger.log(`Unscored transactions scored by=${admin.id}: ${JSON.stringify(result)}`);
      await this.auditService.record({ action: AuditAction.UNSCORED_SCORED, metadata: { ...result } });
      return result;
    });
  }

  // An upload that failed only at scoring (its row counts were saved) becomes
  // COMPLETED. One whose file broke partway stays FAILED with its error.
  private async scoreUpload(upload: UploadBatchModel, targets: TransactionModel[], stored: number) {
    const counts = await this.uploadScoringService.score(targets);
    const flaggedRows = await this.transactionModelAction.countForUpload(upload.id, true);
    const completed = upload.status === UploadStatus.COMPLETED || upload.totalRows > 0;
    await this.uploadBatchModelAction.markRescored(
      upload.id,
      completed ? { acceptedRows: stored, flaggedRows } : { flaggedRows },
      completed,
    );
    return counts;
  }

  private async withLock<T>(run: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    if ((await this.redis.set(LOCK_KEY, token, 'EX', LOCK_SECONDS, 'NX')) !== 'OK') {
      throw new ConflictException('A detection run is already in progress. Try again shortly');
    }
    try {
      return await run();
    } finally {
      await this.redis.eval(RELEASE_IF_OWNER, 1, LOCK_KEY, token);
    }
  }
}
