import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import { TokenService } from '../services/token.service.js';

// Global guard (registered as APP_GUARD in auth.module.ts): every route needs a
// valid token unless it is marked @Public(). Deny by default.
// TODO(template): decide where the token comes from (cookie name, header) and
// finish TokenService.verify(). Until then, protected routes cannot succeed.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const token = request.cookies?.['access_token'];
    if (!token) throw new UnauthorizedException();

    // Attach the user so controllers can read it with @CurrentUser()
    request.user = this.tokenService.verify(token);
    return true;
  }
}
