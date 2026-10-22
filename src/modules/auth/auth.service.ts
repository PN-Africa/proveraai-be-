import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { LoginDto, SignupDto } from './dtos/auth.dto.js';
import {
  AccountProfile,
  AccountService,
  ApprovedAccount,
  PendingAccount,
} from './services/account.service.js';
import { AuthCookieService } from './services/auth-cookie.service.js';
import { CredentialsService } from './services/credentials.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { TokenRevocationService } from './services/token-revocation.service.js';
import { TokenService } from './services/token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly accountService: AccountService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly tokenRevocationService: TokenRevocationService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  async login(dto: LoginDto, req: Request, res: Response): Promise<AccountProfile> {
    const account = await this.credentialsService.authenticate(
      dto.email,
      dto.password,
      req.ip ?? null,
    );
    const access = this.tokenService.signAccessToken(account);
    const refresh = await this.refreshTokenService.issue(account.id);
    this.authCookieService.setSessionCookies(res, access, refresh);
    await this.accountService.recordLogin(account.id);
    return this.accountService.toProfile(account);
  }

  async refresh(req: Request, res: Response): Promise<AccountProfile> {
    try {
      const token = this.authCookieService.readRefreshToken(req);
      if (!token) throw new UnauthorizedException();

      const { accountId, refresh } = await this.refreshTokenService.rotate(token);
      const account = await this.accountService.findActive(accountId);
      if (!account) {
        await this.refreshTokenService.revokeAllForAccount(accountId);
        throw new UnauthorizedException();
      }

      const access = this.tokenService.signAccessToken(account);
      this.authCookieService.setSessionCookies(res, access, refresh);
      return this.accountService.toProfile(account);
    } catch (err) {
      this.authCookieService.clearSessionCookies(res);
      throw err;
    }
  }

  async logout(req: Request, res: Response): Promise<{ message: string }> {
    const accessToken = this.authCookieService.readAccessToken(req);
    if (accessToken) {
      const user = this.verifyOrNull(accessToken);
      if (user) await this.tokenRevocationService.revokeToken(user.jti, user.exp);
    }

    const refreshToken = this.authCookieService.readRefreshToken(req);
    if (refreshToken) await this.refreshTokenService.revoke(refreshToken);

    this.authCookieService.clearSessionCookies(res);
    return { message: 'Logged out' };
  }

  me(user: AuthUser): Promise<AccountProfile> {
    return this.accountService.getActiveProfile(user.id);
  }

  signup(dto: SignupDto): Promise<AccountProfile> {
    return this.accountService.signup(dto);
  }

  // Used by the users module (admin approves sign-ups)
  listPendingAccounts(): Promise<PendingAccount[]> {
    return this.accountService.listPending();
  }

  approveAccount(id: string, adminId: string): Promise<ApprovedAccount> {
    return this.accountService.approve(id, adminId);
  }

  private verifyOrNull(token: string): AuthUser | null {
    try {
      return this.tokenService.verifyAccessTokenIgnoringExpiry(token);
    } catch {
      return null; // forged or garbage: nothing to revoke
    }
  }
}
