import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { MAX_UPLOAD_BYTES } from './services/csv-reader.service.js';
import { TransactionsService } from './transactions.service.js';
import { UploadsController } from './uploads.controller.js';

describe('UploadsController', () => {
  let app: INestApplication<App>;
  const transactionsService = {
    upload: vi.fn(async () => ({ uploadId: 'upload-1', status: 'PENDING' })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: TransactionsService, useValue: transactionsService }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('is restricted to administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UploadsController)).toEqual([Role.ADMIN]);
  });

  it('accepts a .csv file with 202', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .attach('file', Buffer.from('a,b\n1,2\n'), { filename: 'data.csv', contentType: 'text/csv' })
      .expect(202, { uploadId: 'upload-1', status: 'PENDING' });
  });

  it('rejects a file that is not a .csv', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .attach('file', Buffer.from('x'), { filename: 'data.xlsx', contentType: 'application/octet-stream' })
      .expect(400);
  });

  it('rejects a file larger than 5 MB with 413', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .attach('file', Buffer.alloc(MAX_UPLOAD_BYTES + 1, 'a'), {
        filename: 'big.csv',
        contentType: 'text/csv',
      })
      .expect(413);
  });
});
