// OpenAPI (Swagger) decorators for the auth endpoints, kept out of the
// controller so it stays readable. One static method per endpoint.
import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

export class AuthDocs {
  static Login() {
    return applyDecorators(
      ApiOperation({ summary: 'Log in' }),
      ApiResponse({
        status: 200,
        description: 'Sets HTTP-only cookie and returns the user profile',
      }),
      ApiResponse({
        status: 401,
        description: 'Invalid credentials or disabled account',
      }),
    );
  }

  static Logout() {
    return applyDecorators(
      ApiOperation({ summary: 'Log out' }),
      ApiCookieAuth(),
      ApiResponse({
        status: 200,
        description: 'Clears the HTTP-only cookie and ends the session',
      }),
    );
  }

  static Me() {
    return applyDecorators(
      ApiOperation({ summary: 'Get the current user' }),
      ApiCookieAuth(),
      ApiResponse({
        status: 200,
        description: 'Returns the authenticated user',
      }),
    );
  }
}
