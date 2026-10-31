// OpenAPI (Swagger) decorators for the users endpoints
import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

const ADMIN_ONLY = ApiResponse({ status: 403, description: 'Not an administrator' });
const NOT_FOUND = ApiResponse({ status: 404, description: 'Member not found' });
const MEMBER =
  '{ id, fullName, email, role, status, lastActive, createdAt }. lastActive is the last sign-in, null if never';

export class UsersDocs {
  static ListMembers() {
    return applyDecorators(
      ApiOperation({
        summary: 'List workspace members (admin only)',
        description:
          'Approved accounts (ACTIVE and DEACTIVATED), newest first. Pending sign-ups are in GET /users/pending. ' +
          'search matches part of the name or email, any case.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: `A page of members, each ${MEMBER}` }),
      ApiResponse({ status: 400, description: 'Invalid filter' }),
      ADMIN_ONLY,
    );
  }

  static GetMember() {
    return applyDecorators(
      ApiOperation({ summary: 'Get a workspace member (admin only)' }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: MEMBER }),
      ADMIN_ONLY,
      NOT_FOUND,
    );
  }

  static ListPending() {
    return applyDecorators(
      ApiOperation({
        summary: 'List sign-ups waiting for approval (admin only)',
        description: 'Oldest first, at most 100',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'id, fullName, email and createdAt of each pending account' }),
      ADMIN_ONLY,
    );
  }

  static Approve() {
    return applyDecorators(
      ApiOperation({
        summary: 'Approve a sign-up (admin only)',
        description:
          'The analyst can log in from now on. account has the same shape as a row of GET /users, ' +
          'so it can be added to the members table directly.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: `{ message: "Account approved", account: ${MEMBER} }` }),
      ADMIN_ONLY,
      ApiResponse({ status: 404, description: 'No pending account with this id' }),
    );
  }

  static SetStatus() {
    return applyDecorators(
      ApiOperation({
        summary: 'Activate or deactivate a member (admin only)',
        description:
          'status: ACTIVE or DEACTIVATED. Deactivating signs the member out everywhere at once and blocks login. ' +
          'Setting the status it already has changes nothing. Admins cannot change their own status.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: `The updated member, ${MEMBER}` }),
      ApiResponse({ status: 400, description: 'Invalid status, or your own account' }),
      ADMIN_ONLY,
      NOT_FOUND,
      ApiResponse({ status: 409, description: 'The account was changed at the same time' }),
    );
  }

  static Deactivate() {
    return applyDecorators(
      ApiOperation({
        summary: 'Deactivate a member (admin only)',
        description:
          'Same as PATCH /users/{id}/status with DEACTIVATED: ends all their sessions and blocks login.',
      }),
      ApiCookieAuth(),
      ApiResponse({
        status: 200,
        description: `{ message: "Account deactivated", account: ${MEMBER} }`,
      }),
      ApiResponse({ status: 400, description: 'Your own account' }),
      ADMIN_ONLY,
      NOT_FOUND,
      ApiResponse({ status: 409, description: 'The account was changed at the same time' }),
    );
  }
}
