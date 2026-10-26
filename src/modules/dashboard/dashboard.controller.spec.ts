import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

describe('DashboardController', () => {
  let app: INestApplication<App>;
  const transactionsService = {
    getSummary: vi.fn(async () => ({})),
    getTrend: vi.fn(async () => ({})),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [DashboardService, { provide: TransactionsService, useValue: transactionsService }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('is open to every signed-in role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, DashboardController)).toBeUndefined();
  });

  it('passes the range as dates', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/summary?from=2026-10-01T00:00:00Z&to=2026-10-31T23:59:59Z')
      .expect(200);
    expect(transactionsService.getSummary).toHaveBeenCalledWith({
      from: new Date('2026-10-01T00:00:00Z'),
      to: new Date('2026-10-31T23:59:59Z'),
    });
  });

  it('defaults the trend to daily', async () => {
    await request(app.getHttpServer()).get('/dashboard/trends').expect(200);
    expect(transactionsService.getTrend).toHaveBeenCalledWith({ from: undefined, to: undefined }, 'day');
  });

  it('rejects bad input', async () => {
    await request(app.getHttpServer()).get('/dashboard/trends?interval=month').expect(400);
    await request(app.getHttpServer()).get('/dashboard/summary?from=last-week').expect(400);
  });
});
