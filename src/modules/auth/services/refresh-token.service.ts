import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { RefreshTokenModelAction } from '../model-actions/refresh-token-model-action.js';
import type { IssuedToken } from './token.service.js';


const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly refreshTokenModelAction: RefreshTokenModelAction,
    private readonly config: ConfigService,
  ) {}

  async issue(
    accountId: string,
    familyId: string = randomUUID(),
    id: string = randomUUID(),
  ): Promise<IssuedToken> {
    const ttlDays = this.config.getOrThrow<number>('refreshTokenTtlDays');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
    await this.refreshTokenModelAction.create({
      id,
      accountId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt,
    });
    return { token, expiresAt };
  }

  async rotate(token: string): Promise<{ accountId: string; refresh: IssuedToken }> {
    const stored = await this.refreshTokenModelAction.findByHash(hashToken(token));
    if (!stored || stored.expiresAt <= new Date()) throw new UnauthorizedException();

    const replacementId = randomUUID();
    const rotated =
      stored.revokedAt === null &&
      (await this.refreshTokenModelAction.revokeIfActive(stored.id, replacementId));

    if (!rotated) {
      await this.refreshTokenModelAction.revokeFamily(stored.familyId);
      this.logger.warn(
        `Refresh token reuse detected, family revoked: account=${stored.accountId} family=${stored.familyId}`,
      );
      throw new UnauthorizedException();
    }

    const refresh = await this.issue(stored.accountId, stored.familyId, replacementId);
    return { accountId: stored.accountId, refresh };
  }

  async revoke(token: string): Promise<string | null> {
    const stored = await this.refreshTokenModelAction.findByHash(hashToken(token));
    if (!stored) return null;
    await this.refreshTokenModelAction.revokeIfActive(stored.id, null);
    return stored.accountId;
  }

  revokeAllForAccount(accountId: string): Promise<void> {
    return this.refreshTokenModelAction.revokeAllForAccount(accountId);
  }
}
