import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

// Global module: provides one shared Redis client to the whole app.
// Feature modules inject it with @Inject(REDIS_CLIENT), no import needed.
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('redis');
        const client = new Redis(config.getOrThrow<string>('redisUrl'));
        client.on('connect', () => logger.log('Connected'));
        client.on('error', (err) => logger.error(err.message));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // Closes the connection on shutdown (needs app.enableShutdownHooks())
  async onApplicationShutdown() {
    await this.redis.quit();
  }
}
