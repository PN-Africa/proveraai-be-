import { AuditService } from '../../audit/audit.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { Role } from '../../auth/enums/role.enum.js';
import { UploadStatus } from '../enums/upload-status.enum.js';
import { TransactionModelAction } from '../model-actions/transaction-model-action.js';
import { UploadBatchModelAction } from '../model-actions/upload-batch-model-action.js';
import { UploadBatchModel } from '../models/upload-batch.model.js';
import { DetectionRunService } from './detection-run.service.js';
import { UploadScoringService } from './upload-scoring.service.js';

const owner = { id: 'owner-1', role: Role.ANALYST } as AuthUser;

// SET NX and the compare-and-delete release, like Redis
const fakeRedis = () => {
  const store = new Map<string, string>();
  return {
    store,
    set: vi.fn(async (key: string, value: string) => {
      if (store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    eval: vi.fn(async (_script: string, _keys: number, key: string, token: string) => {
      if (store.get(key) !== token) return 0;
      store.delete(key);
      return 1;
    }),
  };
};

const setup = ({
  upload = { id: 'upload-1', status: UploadStatus.COMPLETED, totalRows: 3 } as Partial<UploadBatchModel> | null,
  stored = 3,
  unreviewed = 2,
}: { upload?: Partial<UploadBatchModel> | null; stored?: number; unreviewed?: number } = {}) => {
  const redis = fakeRedis();
  const uploadScoringService = {
    score: vi.fn(async (targets: unknown[]) => ({ scored: targets.length, flagged: 1 })),
  };
  const transactionModelAction = {
    countForUpload: vi.fn(async (_id: string, onlyFlagged = false) => (onlyFlagged ? 2 : stored)),
    findUnreviewedForUpload: vi.fn(async () => Array.from({ length: unreviewed }, (_, i) => ({ id: `tx-${i}` }))),
    findUnscoredForUpload: vi.fn(async () => [{ id: 'tx-9' }]),
    findUploadIdsWithUnscored: vi.fn(async () => ['upload-1', 'upload-2']),
  };
  const uploadBatchModelAction = {
    findById: vi.fn(async (id: string) => (upload ? { ...upload, id } : null)),
    // The owner's own upload only; anything else is not found
    findOne: vi.fn(async ({ where }: { where: { id: string; uploadedById: string } }) =>
      upload && where.uploadedById === 'owner-1' ? { ...upload, id: where.id } : null,
    ),
    markRescored: vi.fn(async () => undefined),
  };
  const service = new DetectionRunService(
    redis as unknown as Redis,
    uploadScoringService as unknown as UploadScoringService,
    transactionModelAction as unknown as TransactionModelAction,
    uploadBatchModelAction as unknown as UploadBatchModelAction,
    { record: vi.fn() } as unknown as AuditService,
  );
  return { service, redis, uploadScoringService, uploadBatchModelAction };
};

describe('DetectionRunService', () => {
  describe('rescoreUpload', () => {
    it('rescores unreviewed transactions and recounts flags for the upload', async () => {
      const { service, uploadBatchModelAction, redis } = setup();
      await expect(service.rescoreUpload('upload-1', owner)).resolves.toEqual({
        uploads: 1,
        scored: 2,
        flagged: 1,
        skippedReviewed: 1,
      });
      expect(uploadBatchModelAction.markRescored).toHaveBeenCalledWith(
        'upload-1',
        { acceptedRows: 3, flaggedRows: 2 },
        true,
      );
      expect(redis.store.size).toBe(0);
    });

    it('completes an upload that failed only at scoring', async () => {
      const { service, uploadBatchModelAction } = setup({
        upload: { status: UploadStatus.FAILED, totalRows: 3 },
      });
      await service.rescoreUpload('upload-1', owner);
      expect(uploadBatchModelAction.markRescored).toHaveBeenCalledWith('upload-1', expect.anything(), true);
    });

    it('keeps a partly read upload FAILED', async () => {
      const { service, uploadBatchModelAction } = setup({
        upload: { status: UploadStatus.FAILED, totalRows: 0 },
      });
      await service.rescoreUpload('upload-1', owner);
      expect(uploadBatchModelAction.markRescored).toHaveBeenCalledWith('upload-1', { flaggedRows: 2 }, false);
    });

    it('refuses uploads that are missing, processing or empty', async () => {
      await expect(setup({ upload: null }).service.rescoreUpload('x', owner)).rejects.toThrow(NotFoundException);
      await expect(
        setup({ upload: { status: UploadStatus.PROCESSING } }).service.rescoreUpload('upload-1', owner),
      ).rejects.toThrow(new ConflictException('This upload is still being processed'));
      await expect(setup({ stored: 0 }).service.rescoreUpload('upload-1', owner)).rejects.toThrow(
        new ConflictException('This upload has no stored transactions'),
      );
    });

    it("treats another account's upload as not found", async () => {
      const other = { id: 'owner-2', role: Role.ANALYST } as AuthUser;
      await expect(setup().service.rescoreUpload('upload-1', other)).rejects.toThrow(NotFoundException);
    });

    it('releases the lock when the run fails', async () => {
      const { service, redis } = setup({ upload: null });
      await expect(service.rescoreUpload('x', owner)).rejects.toThrow();
      expect(redis.store.size).toBe(0);
    });
  });

  it('allows one run at a time per account', async () => {
    const { service, redis } = setup();
    redis.store.set('detection:manual-run:owner-1', 'another-tab');
    await expect(service.scoreUnscored(owner)).rejects.toThrow(
      new ConflictException('A detection run is already in progress. Try again shortly'),
    );
    expect(redis.store.get('detection:manual-run:owner-1')).toBe('another-tab');
    // Another account's run does not block this one
    redis.store.set('detection:manual-run:owner-2', 'x');
    redis.store.delete('detection:manual-run:owner-1');
    await expect(service.scoreUnscored(owner)).resolves.toMatchObject({ uploads: 2 });
  });

  it('scores unscored transactions upload by upload', async () => {
    const { service, uploadScoringService } = setup();
    await expect(service.scoreUnscored(owner)).resolves.toEqual({
      uploads: 2,
      scored: 2,
      flagged: 2,
      skippedReviewed: 0,
    });
    expect(uploadScoringService.score).toHaveBeenCalledTimes(2);
  });
});
