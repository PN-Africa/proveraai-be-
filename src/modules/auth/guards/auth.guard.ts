import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../../../common/decorators/current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator.js';
import { Role } from '../enums/role.enum.js';
import { AuthCookieService } from '../services/auth-cookie.service.js';
import { TokenRevocationService } from '../services/token-revocation.service.js';
import { TokenService } from '../services/token.service.js';

// Global guard (registered as APP_GUARD in auth.module.ts), the single place
// where access is decided (AR-01, AR-16):
// 1. @Public() routes pass.
// 2. Otherwise the access_token cookie must hold a valid, unrevoked token.
// 3. If the route or controller has @Roles(...), the user's role must match.
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly tokenRevocationService: TokenRevocationService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = this.authCookieService.readAccessToken(request);
    if (!token) throw new UnauthorizedException();

    const user = this.tokenService.verifyAccessToken(token);
    if (await this.tokenRevocationService.isRevoked(user)) {
      throw new UnauthorizedException();
    }
    // Attach the user so controllers can read it with @CurrentUser()
    request.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (roles?.length && !roles.includes(user.role)) {
      this.logger.warn(
        `Access denied: account=${user.id} role=${user.role} ${request.method} ${request.path}`,
      );
      throw new ForbiddenException();
    }
    return true;
  }
}
