import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envs } from './config/config.js';
import { validate } from './config/validate-env.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envs],
      validate,
    }),
    RedisModule,
  ],
})
export class CommonModule {}
