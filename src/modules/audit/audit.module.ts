import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditLogModelAction } from './model-actions/audit-log-model-action.js';
import { AuditLogModel } from './models/audit-log.model.js';

// Global: every module records events with AuditService, no import needed
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogModel])],
  controllers: [AuditController],
  providers: [AuditService, AuditLogModelAction],
  exports: [AuditService],
})
export class AuditModule {}
