import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { IssuedToken } from './token.service.js';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const REFRESH_TOKEN_PATH = '/auth';


@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  setSessionCookies(res: Response, access: IssuedToken, refresh: IssuedToken) {
    res.cookie(ACCESS_TOKEN_COOKIE, access.token, {
      ...this.baseOptions(),
      path: '/',
      expires: access.expiresAt,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, refresh.token, {
      ...this.baseOptions(),
      path: REFRESH_TOKEN_PATH,
      expires: refresh.expiresAt,
    });
  }

  clearSessionCookies(res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { ...this.baseOptions(), path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...this.baseOptions(),
      path: REFRESH_TOKEN_PATH,
    });
  }

  readAccessToken(req: Request): string | undefined {
    return this.read(req, ACCESS_TOKEN_COOKIE);
  }

  readRefreshToken(req: Request): string | undefined {
    return this.read(req, REFRESH_TOKEN_COOKIE);
  }

  private read(req: Request, name: string): string | undefined {
    const value: unknown = req.cookies?.[name];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('cookieSecure'),
      sameSite: this.config.getOrThrow<'lax' | 'strict' | 'none'>('cookieSameSite'),
      domain: this.config.get<string>('cookieDomain'),
    };
  }
}
