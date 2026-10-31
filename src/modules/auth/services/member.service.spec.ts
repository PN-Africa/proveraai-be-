import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { AuditService } from '../../audit/audit.service.js';
import { AccountStatus } from '../enums/account-status.enum.js';
import { Role } from '../enums/role.enum.js';
import type { AuthModelAction } from '../model-actions/auth-model-action.js';
import type { AccountModel } from '../models/auth.model.js';
import { MemberService } from './member.service.js';
import type { RefreshTokenService } from './refresh-token.service.js';
import type { TokenRevocationService } from './token-revocation.service.js';

const analyst = (status = AccountStatus.ACTIVE) =>
  ({
    id: 'analyst-1',
    fullName: 'Ada Obi',
    email: 'ada@example.com',
    role: Role.ANALYST,
    status,
    lastLoginAt: new Date('2026-10-30T08:00:00Z'),
    createdAt: new Date('2026-10-01T08:00:00Z'),
    updatedAt: new Date('2026-10-01T08:00:00Z'),
  }) as AccountModel;

const setup = ({ account = analyst() as AccountModel | null, changed = true } = {}) => {
  const authModelAction = {
    findMemberById: vi.fn(async () => account),
    changeStatus: vi.fn(async () => changed),
    findMembers: vi.fn(async () => ({ data: account ? [account] : [], total: 1, page: 1, limit: 20 })),
  };
  const refreshTokenService = { revokeAllForAccount: vi.fn(async () => undefined) };
  const tokenRevocationService = { revokeAllForAccount: vi.fn(async () => undefined) };
  const auditService = { record: vi.fn(async () => undefined) };
  const service = new MemberService(
    authModelAction as unknown as AuthModelAction,
    refreshTokenService as unknown as RefreshTokenService,
    tokenRevocationService as unknown as TokenRevocationService,
    auditService as unknown as AuditService,
  );
  return { service, authModelAction, refreshTokenService, tokenRevocationService, auditService };
};

describe('MemberService', () => {
  it('lists members without password hashes, with lastActive from the last sign-in', async () => {
    const { data } = await setup().service.list({}, 1, 20);
    expect(data[0]).toEqual({
      id: 'analyst-1',
      fullName: 'Ada Obi',
      email: 'ada@example.com',
      role: Role.ANALYST,
      status: AccountStatus.ACTIVE,
      lastActive: new Date('2026-10-30T08:00:00Z'),
      createdAt: new Date('2026-10-01T08:00:00Z'),
    });
  });

  it('returns 404 for an unknown or pending account', async () => {
    await expect(setup({ account: null }).service.get('nope')).rejects.toThrow(NotFoundException);
  });

  describe('setStatus', () => {
    it('deactivates a member and ends every session at once', async () => {
      const { service, authModelAction, refreshTokenService, tokenRevocationService, auditService } = setup();
      await expect(service.setStatus('analyst-1', AccountStatus.DEACTIVATED, 'admin-1')).resolves.toMatchObject({
        status: AccountStatus.DEACTIVATED,
      });
      expect(authModelAction.changeStatus).toHaveBeenCalledWith('analyst-1', AccountStatus.ACTIVE, AccountStatus.DEACTIVATED);
      expect(refreshTokenService.revokeAllForAccount).toHaveBeenCalledWith('analyst-1');
      expect(tokenRevocationService.revokeAllForAccount).toHaveBeenCalledWith('analyst-1');
      expect(auditService.record).toHaveBeenCalledWith({
        action: 'account.deactivated',
        actorId: 'admin-1',
        entityType: 'account',
        entityId: 'analyst-1',
        metadata: { from: AccountStatus.ACTIVE, to: AccountStatus.DEACTIVATED },
      });
    });

    it('reactivates without touching sessions', async () => {
      const { service, tokenRevocationService, auditService } = setup({ account: analyst(AccountStatus.DEACTIVATED) });
      await expect(service.setStatus('analyst-1', AccountStatus.ACTIVE, 'admin-1')).resolves.toMatchObject({
        status: AccountStatus.ACTIVE,
      });
      expect(tokenRevocationService.revokeAllForAccount).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'account.reactivated' }));
    });

    it('does nothing when the status is already set', async () => {
      const { service, authModelAction, auditService } = setup();
      await service.setStatus('analyst-1', AccountStatus.ACTIVE, 'admin-1');
      expect(authModelAction.changeStatus).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('refuses an admin changing their own status', async () => {
      const { service, authModelAction } = setup();
      await expect(service.setStatus('admin-1', AccountStatus.DEACTIVATED, 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(authModelAction.changeStatus).not.toHaveBeenCalled();
    });

    it('turns a concurrent change into 409 and keeps the sessions', async () => {
      const { service, tokenRevocationService } = setup({ changed: false });
      await expect(service.setStatus('analyst-1', AccountStatus.DEACTIVATED, 'admin-1')).rejects.toThrow(
        ConflictException,
      );
      expect(tokenRevocationService.revokeAllForAccount).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown or pending account', async () => {
      await expect(
        setup({ account: null }).service.setStatus('nope', AccountStatus.DEACTIVATED, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
