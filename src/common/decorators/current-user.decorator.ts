import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '../../modules/auth/enums/role.enum.js';

// The user the AuthGuard attaches to the request, built from the access token
// alone (no database lookup)
export interface AuthUser {
  id: string;
  role: Role;
  jti: string; // the access token's own id, used to revoke it
  iat: number; // issued at, in seconds
  exp: number; // expiry, in seconds
}

// Reads the authenticated user that the AuthGuard attached to the request.
// Use it instead of taking a user id from the request body or params:
//   me(@CurrentUser() user: AuthUser) { ... }
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    return request.user;
  },
);
