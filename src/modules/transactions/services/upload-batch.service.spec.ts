import { ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RejectedRowModelAction } from '../model-actions/rejected-row-model-action.js';
import { UploadBatchModelAction } from '../model-actions/upload-batch-model-action.js';
import { UploadBatchService } from './upload-batch.service.js';

const file = Buffer.from('transactionId,amount,currency,timestamp,type\n');
const hashOf = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

const setup = (previous: { id: string; createdAt: Date } | null) => {
  const uploadBatchModelAction = { findNotFailedByHash: vi.fn(async () => previous) };
  const service = new UploadBatchService(
    uploadBatchModelAction as unknown as UploadBatchModelAction,
    {} as RejectedRowModelAction,
  );
  return { service, uploadBatchModelAction };
};

describe('UploadBatchService.assertNotUploadedBefore', () => {
  it('returns the content hash for a new file', async () => {
    const { service, uploadBatchModelAction } = setup(null);
    await expect(service.assertNotUploadedBefore(file)).resolves.toBe(hashOf(file));
    expect(uploadBatchModelAction.findNotFailedByHash).toHaveBeenCalledWith(hashOf(file));
  });

  it('refuses a file uploaded before, naming the earlier upload', async () => {
    const { service } = setup({ id: 'upload-1', createdAt: new Date('2026-10-22T09:00:00Z') });
    await expect(service.assertNotUploadedBefore(file)).rejects.toThrow(
      new ConflictException('This file was already uploaded (upload upload-1, 2026-10-22)'),
    );
  });

  it('treats a file with any change as new', async () => {
    const { service } = setup(null);
    const changed = Buffer.concat([file, Buffer.from('T1,1,NGN,2026-10-01,PAYMENT\n')]);
    expect(await service.assertNotUploadedBefore(changed)).not.toBe(hashOf(file));
  });
});
