import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { REDIS_CLIENT } from '../../../common/redis/redis.constants.js';

const jtiKey = (jti: string) => `auth:revoked:jti:${jti}`;
const accountKey = (accountId: string) => `auth:revoked-before:${accountId}`;

@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  // Logout: revokes one access token
  async revokeToken(jti: string, exp: number): Promise<void> {
    const secondsLeft = exp - Math.floor(Date.now() / 1000);
    if (secondsLeft > 0) await this.redis.set(jtiKey(jti), '1', 'EX', secondsLeft);
  }

  async revokeAllForAccount(accountId: string): Promise<void> {
    const ttlSeconds = this.config.getOrThrow<number>('accessTokenTtlMinutes') * 60;
    const now = String(Math.floor(Date.now() / 1000));
    await this.redis.set(accountKey(accountId), now, 'EX', ttlSeconds);
  }

  // Fails closed: if Redis cannot answer, the request is refused (503) rather
  // than accepting a token that may have been revoked.
  async isRevoked(user: AuthUser): Promise<boolean> {
    try {
      const [revokedJti, revokedBefore] = await this.redis.mget(
        jtiKey(user.jti),
        accountKey(user.id),
      );
      // <= : a token issued in the same second as a revoke-all is rejected too
      return (
        revokedJti !== null ||
        (revokedBefore !== null && user.iat <= Number(revokedBefore))
      );
    } catch (err) {
      this.logger.error(
        `Revocation check unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException();
    }
  }
}
