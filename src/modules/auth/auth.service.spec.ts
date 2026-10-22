import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { Role } from './enums/role.enum.js';
import { AccountService } from './services/account.service.js';
import { AuthCookieService } from './services/auth-cookie.service.js';
import { CredentialsService } from './services/credentials.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { TokenRevocationService } from './services/token-revocation.service.js';
import { TokenService } from './services/token.service.js';

const account = {
  id: 'account-1',
  email: 'analyst@example.com',
  role: Role.ANALYST,
  passwordHash: 'hash',
};
const access = { token: 'access', expiresAt: new Date() };
const refresh = { token: 'refresh', expiresAt: new Date() };

describe('AuthService', () => {
  let service: AuthService;
  const credentialsService = { authenticate: vi.fn() };
  const accountService = {
    findActive: vi.fn(),
    getActiveProfile: vi.fn(),
    recordLogin: vi.fn(),
    toProfile: (a: typeof account) => ({ id: a.id, email: a.email, role: a.role }),
  };
  const tokenService = {
    signAccessToken: vi.fn(() => access),
    verifyAccessTokenIgnoringExpiry: vi.fn(),
  };
  const refreshTokenService = {
    issue: vi.fn(async () => refresh),
    rotate: vi.fn(),
    revoke: vi.fn(),
    revokeAllForAccount: vi.fn(),
  };
  const tokenRevocationService = { revokeToken: vi.fn() };
  const authCookieService = {
    setSessionCookies: vi.fn(),
    clearSessionCookies: vi.fn(),
    readAccessToken: vi.fn(),
    readRefreshToken: vi.fn(),
  };
  const req = { ip: '127.0.0.1' } as Request;
  const res = {} as Response;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CredentialsService, useValue: credentialsService },
        { provide: AccountService, useValue: accountService },
        { provide: TokenService, useValue: tokenService },
        { provide: RefreshTokenService, useValue: refreshTokenService },
        { provide: TokenRevocationService, useValue: tokenRevocationService },
        { provide: AuthCookieService, useValue: authCookieService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('login sets both cookies and returns the profile without the hash', async () => {
    credentialsService.authenticate.mockResolvedValue(account);

    const profile = await service.login(
      { email: account.email, password: 'password' },
      req,
      res,
    );

    expect(authCookieService.setSessionCookies).toHaveBeenCalledWith(res, access, refresh);
    expect(accountService.recordLogin).toHaveBeenCalledWith('account-1');
    expect(profile).toEqual({ id: 'account-1', email: account.email, role: Role.ANALYST });
  });

  it('refresh clears the cookies when the refresh token is rejected', async () => {
    authCookieService.readRefreshToken.mockReturnValue('stolen');
    refreshTokenService.rotate.mockRejectedValue(new UnauthorizedException());

    await expect(service.refresh(req, res)).rejects.toThrow(UnauthorizedException);
    expect(authCookieService.clearSessionCookies).toHaveBeenCalledWith(res);
    expect(authCookieService.setSessionCookies).not.toHaveBeenCalled();
  });

  it('refresh ends every session of a disabled account', async () => {
    authCookieService.readRefreshToken.mockReturnValue('valid');
    refreshTokenService.rotate.mockResolvedValue({ accountId: 'account-1', refresh });
    accountService.findActive.mockResolvedValue(null);

    await expect(service.refresh(req, res)).rejects.toThrow(UnauthorizedException);
    expect(refreshTokenService.revokeAllForAccount).toHaveBeenCalledWith('account-1');
  });

  it('logout revokes both tokens and clears the cookies', async () => {
    authCookieService.readAccessToken.mockReturnValue('access');
    authCookieService.readRefreshToken.mockReturnValue('refresh');
    tokenService.verifyAccessTokenIgnoringExpiry.mockReturnValue({ jti: 'jti-1', exp: 123 });

    await service.logout(req, res);

    expect(tokenRevocationService.revokeToken).toHaveBeenCalledWith('jti-1', 123);
    expect(refreshTokenService.revoke).toHaveBeenCalledWith('refresh');
    expect(authCookieService.clearSessionCookies).toHaveBeenCalledWith(res);
  });

  it('logout still clears the cookies when the access token is garbage', async () => {
    authCookieService.readAccessToken.mockReturnValue('garbage');
    tokenService.verifyAccessTokenIgnoringExpiry.mockImplementation(() => {
      throw new UnauthorizedException();
    });

    await service.logout(req, res);

    expect(tokenRevocationService.revokeToken).not.toHaveBeenCalled();
    expect(authCookieService.clearSessionCookies).toHaveBeenCalledWith(res);
  });
});
