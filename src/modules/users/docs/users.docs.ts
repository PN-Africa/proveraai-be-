// OpenAPI (Swagger) decorators for the users endpoints
import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

export class UsersDocs {
  static ListPending() {
    return applyDecorators(
      ApiOperation({
        summary: 'List sign-ups waiting for approval (admin only)',
        description: 'Oldest first, at most 100',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'id, fullName, email and createdAt of each pending account' }),
      ApiResponse({ status: 403, description: 'Not an administrator' }),
    );
  }

  static Approve() {
    return applyDecorators(
      ApiOperation({
        summary: 'Approve a sign-up (admin only)',
        description: 'The analyst can log in from now on',
      }),
      ApiCookieAuth(),
      ApiResponse({
        status: 200,
        description:
          '{ message: "Account approved", account: { id, fullName, email, role } }',
      }),
      ApiResponse({ status: 403, description: 'Not an administrator' }),
      ApiResponse({ status: 404, description: 'No pending account with this id' }),
    );
  }
}
