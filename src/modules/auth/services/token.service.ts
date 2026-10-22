import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { Role } from '../enums/role.enum.js';

export const JWT_ISSUER = 'proveraai-be';

interface AccessTokenPayload {
  sub: string;
  role: Role;
  jti: string;
  iat: number;
  exp: number;
}

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

// Signs and verifies access tokens (HS256, short-lived: AR-06, AR-09)
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(account: { id: string; role: Role }): IssuedToken {
    const ttlMinutes = this.config.getOrThrow<number>('accessTokenTtlMinutes');
    const token = this.jwtService.sign({
      sub: account.id,
      role: account.role,
      jti: randomUUID(),
    });
    return { token, expiresAt: new Date(Date.now() + ttlMinutes * 60_000) };
  }

  // Throws 401 for anything that is not a valid, unexpired token we issued
  verifyAccessToken(token: string): AuthUser {
    return this.toAuthUser(this.decodeVerified(token, false));
  }

  // Like verifyAccessToken but accepts expired tokens. Only for logout, which
  // must work after the access token has expired.
  verifyAccessTokenIgnoringExpiry(token: string): AuthUser {
    return this.toAuthUser(this.decodeVerified(token, true));
  }

  private decodeVerified(token: string, ignoreExpiration: boolean) {
    try {
      return this.jwtService.verify<AccessTokenPayload>(token, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        ignoreExpiration,
      });
    } catch {
      throw new UnauthorizedException();
    }
  }

  private toAuthUser(payload: AccessTokenPayload): AuthUser {
    const valid =
      typeof payload.sub === 'string' &&
      typeof payload.jti === 'string' &&
      Object.values(Role).includes(payload.role);
    if (!valid) throw new UnauthorizedException();
    return {
      id: payload.sub,
      role: payload.role,
      jti: payload.jti,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
