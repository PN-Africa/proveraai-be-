import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Reads the authenticated user that the AuthGuard attached to the request.
// Use it instead of taking a user id from the request body or params:
//   me(@CurrentUser() user: AuthUser) { ... }
// TODO(template): give the user a real type (id, role, ...) once auth is built.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    return request.user;
  },
);
