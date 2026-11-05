import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

const ID = '7f1c2a9e-3b4d-4c5e-8f6a-1b2c3d4e5f60';

describe('TransactionsController', () => {
  let app: INestApplication<App>;
  const transactionsService = {
    listTransactions: vi.fn(async () => ({ data: [] })),
    decideReview: vi.fn(async () => ({ status: 'CLOSED' })),
    exportCustomerHistory: vi.fn(async () => ({
      fileName: 'customer-CUST-1-transactions.csv',
      content: Buffer.from('transactionId\r\n"TXN-1"\r\n'),
    })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: transactionsService }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('has no claim step', async () => {
    await request(app.getHttpServer()).post(`/transactions/${ID}/review/claim`).expect(404);
  });

  it('parses list filters', async () => {
    await request(app.getHttpServer())
      .get('/transactions?flagged=true&reviewStatus=OPEN&type=payment&page=2')
      .expect(200);
    expect(transactionsService.listTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ flagged: true, reviewStatus: 'OPEN', type: 'PAYMENT', page: 2 }),
      undefined,
    );
  });

  it('rejects unknown filters', async () => {
    await request(app.getHttpServer()).get('/transactions?riskLevel=EXTREME').expect(400);
    await request(app.getHttpServer()).get('/transactions?riskScore=99').expect(400);
    await request(app.getHttpServer()).get('/transactions?reviewStatus=IN_REVIEW').expect(400);
  });

  it('requires a decision with real notes', async () => {
    await request(app.getHttpServer())
      .patch(`/transactions/${ID}/review`)
      .send({ decision: 'CLEARED', notes: '   ok   ' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/transactions/${ID}/review`)
      .send({ decision: 'FRAUD', notes: 'Customer confirmed the payment' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/transactions/${ID}/review`)
      .send({ decision: 'ESCALATED', notes: 'Customer denies making this payment' })
      .expect(200, { status: 'CLOSED' });
  });

  it('downloads customer history as a CSV attachment', async () => {
    const response = await request(app.getHttpServer())
      .get(`/transactions/${ID}/customer-history?from=2026-10-01T00:00:00Z`)
      .expect(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="customer-CUST-1-transactions.csv"',
    );
    expect(response.text).toBe('transactionId\r\n"TXN-1"\r\n');
  });

  it('rejects an invalid date range', async () => {
    await request(app.getHttpServer()).get(`/transactions/${ID}/customer-history?from=yesterday`).expect(400);
  });

  it('rejects an id that is not a uuid', async () => {
    await request(app.getHttpServer()).patch('/transactions/abc/review').send({}).expect(400);
  });
});
