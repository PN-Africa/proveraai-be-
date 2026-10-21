import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

// @nestjs/throttler does not export this type from its entry point
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

// Counts hits in Redis instead of process memory, so the rate limit is shared
// by every instance of the app and survives restarts. Plugged into
// ThrottlerModule in app.module.ts (security checklist, gate 3).
//
// The script runs atomically inside Redis. It mirrors the built-in memory
// storage: count a hit, and once the limit is passed, block the key for
// blockDuration without counting further hits.
// KEYS: hits key, block key. ARGV: ttl, limit, blockDuration (all milliseconds).
const SCRIPT = `
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])
if blockDuration <= 0 then blockDuration = ttl end

local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local current = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {current, math.max(redis.call('PTTL', KEYS[1]), 0), 1, blockTtl}
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ttl) end
local timeToExpire = redis.call('PTTL', KEYS[1])

if hits > limit then
  redis.call('SET', KEYS[2], '1', 'PX', blockDuration)
  return {hits, timeToExpire, 1, blockDuration}
end
return {hits, timeToExpire, 0, 0}
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'throttle',
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const base = `${this.prefix}:${throttlerName}:${key}`;
    try {
      const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] =
        (await this.redis.eval(
          SCRIPT,
          2,
          `${base}:hits`,
          `${base}:block`,
          ttl,
          limit,
          blockDuration,
        )) as number[];

      // The throttler expects seconds for both expiry fields
      return {
        totalHits,
        timeToExpire: Math.ceil(timeToExpire / 1000),
        isBlocked: isBlocked === 1,
        timeToBlockExpire: Math.ceil(timeToBlockExpire / 1000),
      };
    } catch (err) {
      // Fail open: if Redis is down, keep serving requests instead of
      // returning errors to every user. The limit is not enforced until Redis
      // is back, so watch for this log line.
      this.logger.error(
        `Rate limit store unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
