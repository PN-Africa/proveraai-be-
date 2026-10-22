import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccountStatus } from '../enums/account-status.enum.js';
import { Role } from '../enums/role.enum.js';
import { AuthModelAction } from '../model-actions/auth-model-action.js';
import { AccountModel } from '../models/auth.model.js';
import { CredentialsService } from './credentials.service.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { PasswordService } from './password.service.js';

const accountData = {
  id: 'account-1',
  email: 'analyst@example.com',
  passwordHash: 'hash',
  role: Role.ANALYST,
  status: AccountStatus.ACTIVE,
};
const account = accountData as AccountModel;

const setup = ({
  found = account as AccountModel | null,
  passwordOk = true,
  locked = false,
} = {}) => {
  const authModelAction = { findByEmail: vi.fn(async () => found) };
  const passwordService = {
    verify: vi.fn(async () => passwordOk),
    verifyDummy: vi.fn(async () => undefined),
  };
  const loginLockoutService = {
    isLocked: vi.fn(async () => locked),
    registerFailure: vi.fn(async () => false),
    reset: vi.fn(async () => undefined),
  };
  const service = new CredentialsService(
    authModelAction as unknown as AuthModelAction,
    passwordService as unknown as PasswordService,
    loginLockoutService as unknown as LoginLockoutService,
  );
  const attempt = () => service.authenticate('analyst@example.com', 'password', '127.0.0.1');
  return { attempt, authModelAction, passwordService, loginLockoutService };
};

// AR-04: every failure looks the same to the caller
const expectGenericFailure = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(UnauthorizedException);
  expect((error as UnauthorizedException).message).toBe('Invalid credentials');
};

describe('CredentialsService', () => {
  it('returns the account and clears failures on success', async () => {
    const { attempt, loginLockoutService } = setup();
    await expect(attempt()).resolves.toBe(account);
    expect(loginLockoutService.reset).toHaveBeenCalledWith('analyst@example.com');
  });

  it('fails generically for an unknown email, after a dummy hash check', async () => {
    const { attempt, passwordService, loginLockoutService } = setup({ found: null });
    await expectGenericFailure(attempt());
    expect(passwordService.verifyDummy).toHaveBeenCalled();
    expect(loginLockoutService.registerFailure).toHaveBeenCalled();
  });

  it('fails generically for a wrong password and counts the failure', async () => {
    const { attempt, loginLockoutService } = setup({ passwordOk: false });
    await expectGenericFailure(attempt());
    expect(loginLockoutService.registerFailure).toHaveBeenCalledWith('analyst@example.com');
  });

  it('tells a pending account with the right password that it awaits approval', async () => {
    const { attempt } = setup({
      found: { ...accountData, status: AccountStatus.PENDING } as AccountModel,
    });
    const error = await attempt().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).message).toBe('Account pending approval');
  });

  it('fails generically for a pending account with the wrong password', async () => {
    const { attempt } = setup({
      found: { ...accountData, status: AccountStatus.PENDING } as AccountModel,
      passwordOk: false,
    });
    await expectGenericFailure(attempt());
  });

  it('refuses a locked account without checking the password (AR-03)', async () => {
    const { attempt, authModelAction, passwordService } = setup({ locked: true });
    await expectGenericFailure(attempt());
    expect(authModelAction.findByEmail).not.toHaveBeenCalled();
    expect(passwordService.verify).not.toHaveBeenCalled();
  });
});
