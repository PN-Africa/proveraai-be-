import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CommonModule } from './common/common.module.js';
import { REDIS_CLIENT } from './common/redis/redis.constants.js';
import { RedisThrottlerStorage } from './common/redis/redis-throttler-storage.js';
import { dataSource } from './database/data-source.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
// nest-kit:imports

export const { ObserveModule, ObserveInstrument } = createObserveModule();

// Observe sends telemetry to an external collector, so it only runs when both
// keys are set. Without keys it would still send, and the batches get dropped.
const observeAppKey = process.env.OBSERVE_APP_KEY;
const observeAppSecret = process.env.OBSERVE_APP_SECRET;
export const observeEnabled = Boolean(observeAppKey && observeAppSecret);

@Module({
  imports: [
    // Distributed tracing, correlated logs, metrics and alarms.
    // Keys come from https://observe.nestjs.com (see .env.example).
    ...(observeAppKey && observeAppSecret
      ? [
          ObserveModule.forRoot({
            appKey: observeAppKey,
            appSecret: observeAppSecret,
            serviceId: 'proveraai-be',
          }),
        ]
      : []),

    // Rate limiting: 60 requests per minute per client. Counters live in Redis
    // (shared by every instance), see common/redis/redis-throttler-storage.ts
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [{ ttl: 60000, limit: 60 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),

    // Config + env validation
    CommonModule,

    // Database (shared data source, see database/data-source.ts)
    TypeOrmModule.forRootAsync({
      useFactory: () => ({ ...dataSource.options }),
      dataSourceFactory: async () => {
        if (!dataSource.isInitialized) {
          await dataSource.initialize();
        }
        return dataSource;
      },
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    // nest-kit:modules
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
