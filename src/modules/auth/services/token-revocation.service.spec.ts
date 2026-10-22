import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { Role } from '../enums/role.enum.js';
import { TokenRevocationService } from './token-revocation.service.js';

class FakeRedis {
  values = new Map<string, string>();
  down = false;

  async set(key: string, value: string) {
    this.values.set(key, value);
    return 'OK';
  }
  async mget(...keys: string[]) {
    if (this.down) throw new Error('connection refused');
    return keys.map((key) => this.values.get(key) ?? null);
  }
}

const config = {
  getOrThrow: (key: string) => ({ accessTokenTtlMinutes: 15 })[key],
} as unknown as ConfigService;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const tokenFor = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'account-1',
  role: Role.ANALYST,
  jti: 'jti-1',
  iat: nowSeconds() - 60,
  exp: nowSeconds() + 840,
  ...overrides,
});

const setup = () => {
  const redis = new FakeRedis();
  return {
    redis,
    service: new TokenRevocationService(redis as unknown as Redis, config),
  };
};

describe('TokenRevocationService', () => {
  it('revokes one token without affecting others', async () => {
    const { service } = setup();
    const token = tokenFor();
    await service.revokeToken(token.jti, token.exp);

    expect(await service.isRevoked(token)).toBe(true);
    expect(await service.isRevoked(tokenFor({ jti: 'jti-2' }))).toBe(false);
  });

  it('skips tokens that have already expired', async () => {
    const { redis, service } = setup();
    await service.revokeToken('old', nowSeconds() - 5);
    expect(redis.values.size).toBe(0);
  });

  it('revokes every token the account holds, but not later ones', async () => {
    const { service } = setup();
    await service.revokeAllForAccount('account-1');

    expect(await service.isRevoked(tokenFor())).toBe(true);
    expect(await service.isRevoked(tokenFor({ iat: nowSeconds() + 1 }))).toBe(false);
    expect(await service.isRevoked(tokenFor({ id: 'account-2' }))).toBe(false);
  });

  it('fails closed with 503 when Redis is unavailable', async () => {
    const { redis, service } = setup();
    redis.down = true;
    await expect(service.isRevoked(tokenFor())).rejects.toThrow(ServiceUnavailableException);
  });
});
