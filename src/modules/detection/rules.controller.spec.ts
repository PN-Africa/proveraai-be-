import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { RulesController } from './rules.controller.js';
import { RulesService } from './rules.service.js';

describe('RulesController', () => {
  let app: INestApplication<App>;
  const rulesService = { update: vi.fn(async () => ({ version: 2 })) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RulesController],
      providers: [{ provide: RulesService, useValue: rulesService }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('is restricted to administrators (AR-18)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, RulesController)).toEqual([Role.ADMIN]);
  });

  it('accepts a valid edit', async () => {
    await request(app.getHttpServer())
      .patch('/rules/high-amount-ngn')
      .send({ version: 1, weight: 40 })
      .expect(200, { version: 2 });
  });

  it('rejects a bad body or rule key', async () => {
    await request(app.getHttpServer()).patch('/rules/high-amount-ngn').send({ weight: 40 }).expect(400);
    await request(app.getHttpServer()).patch('/rules/high-amount-ngn').send({ version: 1, weight: 101 }).expect(400);
    await request(app.getHttpServer()).patch('/rules/high-amount-ngn').send({ version: 1, type: 'VELOCITY' }).expect(400);
    await request(app.getHttpServer()).patch('/rules/Bad%20Key').send({ version: 1, weight: 1 }).expect(400);
  });
});
