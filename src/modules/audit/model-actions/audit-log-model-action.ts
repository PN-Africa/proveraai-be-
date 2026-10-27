import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, QueryDeepPartialEntity, Repository } from 'typeorm';
import { AuditLogModel } from '../models/audit-log.model.js';

export type AuditEntry = Omit<AuditLogModel, 'id'>;

export interface AuditFilters {
  action?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
}

// Any number, as long as nothing else in the app uses the same advisory lock
const CHAIN_LOCK = 7_310_241;

// Deliberately not an AbstractModel: the audit log has no update or delete
@Injectable()
export class AuditLogModelAction {
  constructor(
    @InjectRepository(AuditLogModel)
    private readonly auditLogRepository: Repository<AuditLogModel>,
  ) {}

  // Appends one entry. build gets the previous hash and returns the entry.
  // The transaction-scoped lock makes appends one at a time, so the chain
  // never forks, even across several app instances.
  append(build: (prevHash: string | null) => AuditEntry): Promise<void> {
    return this.auditLogRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [CHAIN_LOCK]);
      const [last] = await manager.find(AuditLogModel, {
        select: { hash: true },
        order: { id: 'DESC' },
        take: 1,
      });
      // metadata is free-form JSON, which TypeORM's insert type cannot express
      await manager.insert(AuditLogModel, build(last?.hash ?? null) as QueryDeepPartialEntity<AuditLogModel>);
    });
  }

  async findPage(filters: AuditFilters, page: number, limit: number) {
    const query = this.auditLogRepository.createQueryBuilder('a');
    if (filters.action) query.andWhere('a.action = :action', { action: filters.action });
    if (filters.actorId) query.andWhere('a.actorId = :actorId', { actorId: filters.actorId });
    if (filters.entityType) query.andWhere('a.entityType = :entityType', { entityType: filters.entityType });
    if (filters.entityId) query.andWhere('a.entityId = :entityId', { entityId: filters.entityId });
    if (filters.from) query.andWhere('a.occurredAt >= :from', { from: filters.from });
    if (filters.to) query.andWhere('a.occurredAt <= :to', { to: filters.to });

    const [data, total] = await query
      .orderBy('a.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const totalPages = Math.ceil(total / limit);
    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  // In chain order, after the given id
  findAfter(id: string, take: number): Promise<AuditLogModel[]> {
    return this.auditLogRepository.find({ where: { id: MoreThan(id) }, order: { id: 'ASC' }, take });
  }
}
