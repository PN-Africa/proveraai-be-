import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { AuditService } from './audit.service.js';
import { AuditDocs } from './docs/audit.docs.js';
import { ListAuditLogsQueryDto } from './dtos/list-audit-logs-query.dto.js';

@ApiTags('audit')
@Roles(Role.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @AuditDocs.List()
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.list(
      {
        action: query.action,
        actorId: query.actorId,
        entityType: query.entityType,
        entityId: query.entityId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      query.page ?? 1,
      query.limit ?? 50,
    );
  }

  // Reads the whole log, so it is rate limited
  @Get('verify')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @AuditDocs.Verify()
  verify() {
    return this.auditService.verify();
  }
}
