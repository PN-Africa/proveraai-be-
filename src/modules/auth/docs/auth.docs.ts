// OpenAPI (Swagger) decorators for the auth endpoints, kept out of the
// controller so it stays readable. One static method per endpoint.
import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

export class AuthDocs {
  static Signup() {
    return applyDecorators(
      ApiOperation({
        summary: 'Sign up',
        description:
          'Creates an analyst account pending admin approval. It cannot log in until approved.',
      }),
      ApiResponse({
        status: 201,
        description: 'id, fullName, email and role of the pending account',
      }),
      ApiResponse({
        status: 400,
        description: 'Full name not 2 to 100 characters, invalid email, or password policy not met',
      }),
      ApiResponse({ status: 409, description: 'An account with this email already exists' }),
      ApiResponse({ status: 429, description: 'Too many sign-ups from this IP' }),
    );
  }

  static Login() {
    return applyDecorators(
      ApiOperation({ summary: 'Log in' }),
      ApiResponse({
        status: 200,
        description:
          'Sets the access_token and refresh_token httpOnly cookies and returns the profile',
      }),
      ApiResponse({
        status: 401,
        description:
          'Invalid credentials. Same response for an unknown email, a wrong password and a locked account',
      }),
      ApiResponse({
        status: 403,
        description: 'Correct password, but the account is still pending admin approval',
      }),
      ApiResponse({ status: 429, description: 'Too many attempts from this IP' }),
    );
  }

  static Refresh() {
    return applyDecorators(
      ApiOperation({
        summary: 'Get a new access token',
        description:
          'Uses the refresh_token cookie and rotates it. Call it when a request returns 401, ' +
          'and only once at a time: replaying a used refresh token ends the session.',
      }),
      ApiResponse({ status: 200, description: 'Sets fresh cookies and returns the profile' }),
      ApiResponse({
        status: 401,
        description: 'Session ended or invalid. Cookies are cleared; show the login page',
      }),
    );
  }

  static Logout() {
    return applyDecorators(
      ApiOperation({ summary: 'Log out' }),
      ApiResponse({
        status: 200,
        description: 'Revokes the session tokens and clears the cookies',
      }),
    );
  }

  static Me() {
    return applyDecorators(
      ApiOperation({ summary: 'Get the current user' }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'id, fullName, email and role' }),
      ApiResponse({ status: 401, description: 'Not signed in or session revoked' }),
    );
  }
}
