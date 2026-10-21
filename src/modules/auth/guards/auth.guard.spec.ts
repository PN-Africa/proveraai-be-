import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { TokenService } from '../services/token.service.js';

// Builds a fake execution context carrying the given cookies
const makeContext = (cookies: Record<string, string> = {}) =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ cookies }) }),
  }) as unknown as ExecutionContext;

const makeGuard = (isPublic: boolean, tokenService: Partial<TokenService> = {}) =>
  new AuthGuard(
    { getAllAndOverride: () => isPublic } as unknown as Reflector,
    tokenService as TokenService,
  );

describe('AuthGuard', () => {
  it('lets @Public() routes through', () => {
    expect(makeGuard(true).canActivate(makeContext())).toBe(true);
  });

  it('rejects a protected route when there is no token', () => {
    expect(() => makeGuard(false).canActivate(makeContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the verified user for a valid token', () => {
    const request: { cookies: Record<string, string>; user?: unknown } = {
      cookies: { access_token: 'token' },
    };
    const context = {
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = makeGuard(false, { verify: () => ({ id: 'user-1' }) });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual({ id: 'user-1' });
  });
});
