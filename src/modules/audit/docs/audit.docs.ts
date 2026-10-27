import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

const ADMIN_ONLY = ApiResponse({ status: 403, description: 'Not an administrator' });

export class AuditDocs {
  static List() {
    return applyDecorators(
      ApiOperation({
        summary: 'List audit log entries, newest first (admin only)',
        description:
          'Each entry: id, occurredAt, actorId, actorRole, action, entityType, entityId, metadata, ip, prevHash, hash',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'A page of entries' }),
      ApiResponse({ status: 400, description: 'Invalid filter' }),
      ADMIN_ONLY,
    );
  }

  static Verify() {
    return applyDecorators(
      ApiOperation({
        summary: 'Check that no audit entry was changed or removed (admin only)',
        description:
          'Recomputes the hash chain. valid=false names the first entry that no longer matches.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: '{ valid, checked, firstInvalidId }' }),
      ADMIN_ONLY,
    );
  }
}
