import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { RefreshTokenModelAction } from '../model-actions/refresh-token-model-action.js';
import { RefreshTokenModel } from '../models/refresh-token.model.js';
import { RefreshTokenService } from './refresh-token.service.js';

type Row = Pick<
  RefreshTokenModel,
  'id' | 'accountId' | 'familyId' | 'tokenHash' | 'expiresAt' | 'revokedAt' | 'replacedById'
>;

// In-memory stand-in for the model action. Returns copies, like a database.
class FakeRefreshTokenModelAction {
  rows = new Map<string, Row>();

  async create(data: Omit<Row, 'revokedAt' | 'replacedById'>) {
    this.rows.set(data.id, { ...data, revokedAt: null, replacedById: null });
  }

  async findByHash(tokenHash: string) {
    const row = [...this.rows.values()].find((r) => r.tokenHash === tokenHash);
    return row ? { ...row } : null;
  }

  async revokeIfActive(id: string, replacedById: string | null) {
    const row = this.rows.get(id);
    if (!row || row.revokedAt) return false;
    Object.assign(row, { revokedAt: new Date(), replacedById });
    return true;
  }

  async revokeFamily(familyId: string) {
    for (const row of this.rows.values()) {
      if (row.familyId === familyId) row.revokedAt ??= new Date();
    }
  }

  async revokeAllForAccount(accountId: string) {
    for (const row of this.rows.values()) {
      if (row.accountId === accountId) row.revokedAt ??= new Date();
    }
  }
}

const config = {
  getOrThrow: (key: string) => ({ refreshTokenTtlDays: 7 })[key],
} as unknown as ConfigService;

const setup = () => {
  const store = new FakeRefreshTokenModelAction();
  const service = new RefreshTokenService(
    store as unknown as RefreshTokenModelAction,
    config,
  );
  return { store, service };
};

describe('RefreshTokenService', () => {
  it('stores only a hash of the token', async () => {
    const { store, service } = setup();
    const { token } = await service.issue('account-1');
    const [row] = store.rows.values();

    expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('rotates a token into a new one in the same family', async () => {
    const { store, service } = setup();
    const first = await service.issue('account-1');
    const { accountId, refresh } = await service.rotate(first.token);

    expect(accountId).toBe('account-1');
    expect(refresh.token).not.toBe(first.token);
    const [old, current] = store.rows.values();
    expect(old.revokedAt).not.toBeNull();
    expect(old.replacedById).toBe(current.id);
    expect(current.familyId).toBe(old.familyId);
    expect(current.revokedAt).toBeNull();
  });

  it('revokes the whole family when a used token is replayed', async () => {
    const { store, service } = setup();
    const first = await service.issue('account-1');
    await service.rotate(first.token);

    await expect(service.rotate(first.token)).rejects.toThrow(UnauthorizedException);
    expect([...store.rows.values()].every((r) => r.revokedAt !== null)).toBe(true);
  });

  it('lets only one of two simultaneous rotations succeed', async () => {
    const { service } = setup();
    const first = await service.issue('account-1');
    const results = await Promise.allSettled([
      service.rotate(first.token),
      service.rotate(first.token),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('rejects an expired token', async () => {
    const { store, service } = setup();
    const { token } = await service.issue('account-1');
    for (const row of store.rows.values()) row.expiresAt = new Date(Date.now() - 1000);

    await expect(service.rotate(token)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown token', async () => {
    const { service } = setup();
    await expect(service.rotate('not-a-real-token')).rejects.toThrow(UnauthorizedException);
  });

  it('cannot rotate a token after logout revoked it', async () => {
    const { service } = setup();
    const { token } = await service.issue('account-1');
    expect(await service.revoke(token)).toBe('account-1');

    await expect(service.rotate(token)).rejects.toThrow(UnauthorizedException);
  });
});
