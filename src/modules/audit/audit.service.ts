import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { currentRequest } from '../../common/request-context/request-context.js';
import { AuditAction } from './enums/audit-action.enum.js';
import {
  type AuditEntry,
  type AuditFilters,
  AuditLogModelAction,
} from './model-actions/audit-log-model-action.js';

export interface AuditEvent {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  // Defaults to the signed-in user of the current request. Set it when there
  // is none yet (login) or the actor is someone else.
  actorId?: string | null;
  actorRole?: string | null;
}

const GENESIS_HASH = '0'.repeat(64);
const VERIFY_BATCH = 1000;

// JSON with object keys sorted, because Postgres jsonb does not keep key order
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

export const hashEntry = (entry: Omit<AuditEntry, 'hash'>): string =>
  createHash('sha256')
    .update(
      canonical([
        entry.prevHash,
        entry.occurredAt.toISOString(),
        entry.actorId,
        entry.actorRole,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.metadata,
        entry.ip,
      ]),
    )
    .digest('hex');

// Exported to every module (AuditModule is global)
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditLogModelAction: AuditLogModelAction) {}

  // Never throws: a failed audit write is logged as an error and the user's
  // action goes ahead
  async record(event: AuditEvent): Promise<void> {
    const request = currentRequest();
    try {
      // Stored as JSON, so hash exactly what jsonb will give back
      const metadata = JSON.parse(JSON.stringify(event.metadata ?? {})) as Record<string, unknown>;
      await this.auditLogModelAction.append((prevHash) => {
        const entry = {
          occurredAt: new Date(),
          actorId: event.actorId !== undefined ? event.actorId : (request?.user?.id ?? null),
          actorRole: event.actorRole !== undefined ? event.actorRole : (request?.user?.role ?? null),
          action: event.action,
          entityType: event.entityType ?? null,
          entityId: event.entityId ?? null,
          metadata,
          ip: request?.ip ?? null,
          prevHash: prevHash ?? GENESIS_HASH,
        };
        return { ...entry, hash: hashEntry(entry) };
      });
    } catch (err) {
      this.logger.error(
        `Audit write failed for ${event.action} ${event.entityType ?? ''}:${event.entityId ?? ''}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  list(filters: AuditFilters, page: number, limit: number) {
    return this.auditLogModelAction.findPage(filters, page, limit);
  }

  // Recomputes the whole chain. Any edited or deleted row (other than the
  // newest ones) makes it invalid from that row on.
  async verify(): Promise<{ valid: boolean; checked: number; firstInvalidId: string | null }> {
    let prevHash = GENESIS_HASH;
    let lastId = '0';
    let checked = 0;
    for (;;) {
      const batch = await this.auditLogModelAction.findAfter(lastId, VERIFY_BATCH);
      if (batch.length === 0) return { valid: true, checked, firstInvalidId: null };
      for (const row of batch) {
        if (row.prevHash !== prevHash || hashEntry(row) !== row.hash) {
          this.logger.error(`Audit chain broken at entry ${row.id}`);
          return { valid: false, checked, firstInvalidId: row.id };
        }
        prevHash = row.hash;
        lastId = row.id;
        checked++;
      }
    }
  }
}
