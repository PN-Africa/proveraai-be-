import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { AuditService } from './audit.service.js';
import { AuditDocs } from './docs/audit.docs.js';
import { ListAuditLogsQueryDto } from './dtos/list-audit-logs-query.dto.js';

// Each account reads only its own activity. The chain check
// (AuditService.verify) is for operators, not exposed over HTTP.
@ApiTags('audit')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @AuditDocs.List()
  list(@Query() query: ListAuditLogsQueryDto, @CurrentUser() user: AuthUser) {
    return this.auditService.list(
      {
        action: query.action,
        actorId: user.id,
        entityType: query.entityType,
        entityId: query.entityId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      query.page ?? 1,
      query.limit ?? 50,
    );
  }
}
