import type { Redis } from 'ioredis';
import {
  LOCKOUT_SECONDS,
  LoginLockoutService,
  MAX_FAILED_LOGINS,
} from './login-lockout.service.js';

class FakeRedis {
  values = new Map<string, string>();
  ttls = new Map<string, number>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async incr(key: string) {
    const next = Number(this.values.get(key) ?? 0) + 1;
    this.values.set(key, String(next));
    return next;
  }
  async expire(key: string, seconds: number) {
    this.ttls.set(key, seconds);
    return 1;
  }
  async del(key: string) {
    this.values.delete(key);
    return 1;
  }
}

const setup = () => {
  const redis = new FakeRedis();
  return { redis, service: new LoginLockoutService(redis as unknown as Redis) };
};
const email = 'analyst@example.com';

describe('LoginLockoutService', () => {
  it(`locks the account on failure number ${MAX_FAILED_LOGINS}, not before`, async () => {
    const { service } = setup();
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      expect(await service.registerFailure(email)).toBe(false);
      expect(await service.isLocked(email)).toBe(false);
    }
    expect(await service.registerFailure(email)).toBe(true);
    expect(await service.isLocked(email)).toBe(true);
  });

  it('keeps the lock for the full lockout period', async () => {
    const { redis, service } = setup();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await service.registerFailure(email);
    expect([...redis.ttls.values()]).toEqual([LOCKOUT_SECONDS]);
  });

  it('clears the failures after a successful login', async () => {
    const { service } = setup();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await service.registerFailure(email);
    await service.reset(email);
    expect(await service.isLocked(email)).toBe(false);
  });

  it('does not store the email address in Redis', async () => {
    const { redis, service } = setup();
    await service.registerFailure(email);
    expect([...redis.values.keys()].join()).not.toContain(email);
  });
});
