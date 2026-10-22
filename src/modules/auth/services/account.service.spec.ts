import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus } from '../enums/account-status.enum.js';
import { Role } from '../enums/role.enum.js';
import { AuthModelAction } from '../model-actions/auth-model-action.js';
import { AccountService } from './account.service.js';
import { PasswordService } from './password.service.js';

const setup = ({ emailTaken = false, pendingExists = true } = {}) => {
  const authModelAction = {
    existsByEmail: vi.fn(async () => emailTaken),
    create: vi.fn(async (data: Record<string, unknown>) => ({ id: 'new-id', ...data })),
    activatePending: vi.fn(async () => pendingExists),
  };
  const passwordService = { hash: vi.fn(async (p: string) => `hashed:${p}`) };
  const service = new AccountService(
    authModelAction as unknown as AuthModelAction,
    passwordService as unknown as PasswordService,
  );
  return { service, authModelAction };
};

const password = 'a-long-enough-password';

describe('AccountService', () => {
  describe('signup', () => {
    it('creates a pending analyst with a normalised email and hashed password', async () => {
      const { service, authModelAction } = setup();

      const profile = await service.signup({
        fullName: ' Ada Lovelace ',
        email: '  Analyst@Example.COM ',
        password,
      });

      expect(authModelAction.create).toHaveBeenCalledWith({
        fullName: 'Ada Lovelace',
        email: 'analyst@example.com',
        role: Role.ANALYST,
        status: AccountStatus.PENDING,
        passwordHash: `hashed:${password}`,
      });
      expect(profile).toEqual({
        id: 'new-id',
        fullName: 'Ada Lovelace',
        email: 'analyst@example.com',
        role: Role.ANALYST,
      });
    });

    it('rejects an email that already has an account', async () => {
      const { service, authModelAction } = setup({ emailTaken: true });
      await expect(
        service.signup({ fullName: 'Ada Lovelace', email: 'a@example.com', password }),
      ).rejects.toThrow(ConflictException);
      expect(authModelAction.create).not.toHaveBeenCalled();
    });

    it('rejects a password shorter than 12 characters (AR-05)', async () => {
      const { service } = setup();
      await expect(
        service.signup({ fullName: 'Ada Lovelace', email: 'a@example.com', password: 'short' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('activates a pending account', async () => {
      const { service, authModelAction } = setup();
      await service.approve('account-1', 'admin-1');
      expect(authModelAction.activatePending).toHaveBeenCalledWith('account-1');
    });

    it('returns 404 when there is no pending account with that id', async () => {
      const { service } = setup({ pendingExists: false });
      await expect(service.approve('missing', 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });
});
