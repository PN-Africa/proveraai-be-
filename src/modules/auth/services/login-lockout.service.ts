import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { REDIS_CLIENT } from '../../../common/redis/redis.constants.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_SECONDS = 15 * 60;

const failuresKey = (email: string) =>
  `auth:login-failures:${createHash('sha256').update(email).digest('hex')}`;

// Locks an account for 15 minutes after 5 failed logins within 15 minutes
@Injectable()
export class LoginLockoutService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async isLocked(email: string): Promise<boolean> {
    const failures = await this.redis.get(failuresKey(email));
    return Number(failures ?? 0) >= MAX_FAILED_LOGINS;
  }

  // Returns true when this failure locks the account
  async registerFailure(email: string): Promise<boolean> {
    const key = failuresKey(email);
    const failures = await this.redis.incr(key);
    if (failures === 1 || failures >= MAX_FAILED_LOGINS) {
      // The window starts at the first failure; reaching the limit restarts it
      // so the lock lasts the full 15 minutes
      await this.redis.expire(key, LOCKOUT_SECONDS);
    }
    return failures === MAX_FAILED_LOGINS;
  }

  async reset(email: string): Promise<void> {
    await this.redis.del(failuresKey(email));
  }
}
