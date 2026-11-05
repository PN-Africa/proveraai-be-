import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import { Role } from '../enums/role.enum.js';
import { AuthCookieService } from '../services/auth-cookie.service.js';
import { TokenRevocationService } from '../services/token-revocation.service.js';
import { TokenService } from '../services/token.service.js';
import { AuthGuard } from './auth.guard.js';

const analyst: AuthUser = { id: 'account-1', role: Role.ANALYST, jti: 'jti-1', iat: 1, exp: 2 };

interface Setup {
  isPublic?: boolean;
  cookie?: string | null;
  verify?: () => AuthUser;
  revoked?: boolean | Error;
}

const setup = ({
  isPublic = false,
  cookie = 'token',
  verify = () => analyst,
  revoked = false,
}: Setup = {}) => {
  const request: { cookies: Record<string, string>; user?: AuthUser } = {
    cookies: cookie ? { access_token: cookie } : {},
  };
  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: (key: string) => (key === IS_PUBLIC_KEY ? isPublic : undefined),
  } as unknown as Reflector;
  const tokenService = { verifyAccessToken: vi.fn(verify) };
  const tokenRevocationService = {
    isRevoked: vi.fn(async () => {
      if (revoked instanceof Error) throw revoked;
      return revoked;
    }),
  };
  const guard = new AuthGuard(
    reflector,
    tokenService as unknown as TokenService,
    tokenRevocationService as unknown as TokenRevocationService,
    new AuthCookieService({} as ConfigService),
  );
  return { guard, context, request, tokenService };
};

describe('AuthGuard', () => {
  it('lets @Public() routes through without a token', async () => {
    const { guard, context, tokenService } = setup({ isPublic: true, cookie: null });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects a protected route when there is no token (AR-01)', async () => {
    const { guard, context } = setup({ cookie: null });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const { guard, context } = setup({
      verify: () => {
        throw new UnauthorizedException();
      },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a revoked token (AR-11)', async () => {
    const { guard, context } = setup({ revoked: true });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('fails closed with 503 when the revocation store is down', async () => {
    const { guard, context } = setup({ revoked: new ServiceUnavailableException() });
    await expect(guard.canActivate(context)).rejects.toThrow(ServiceUnavailableException);
  });

  it('attaches the verified user for a valid token', async () => {
    const { guard, context, request } = setup();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(analyst);
  });
});
