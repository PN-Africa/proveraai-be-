import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

export class AuditDocs {
  static List() {
    return applyDecorators(
      ApiOperation({
        summary: 'List your own activity, newest first',
        description:
          'Each entry: id, occurredAt, actorId, actorRole, action, entityType, entityId, metadata, ip, prevHash, hash',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: 'A page of entries' }),
      ApiResponse({ status: 400, description: 'Invalid filter' }),
    );
  }
}
