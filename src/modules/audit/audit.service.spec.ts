import type { Request } from 'express';
import { requestContextMiddleware } from '../../common/request-context/request-context.js';
import { Role } from '../auth/enums/role.enum.js';
import { AuditService } from './audit.service.js';
import { AuditAction } from './enums/audit-action.enum.js';
import type { AuditEntry, AuditLogModelAction } from './model-actions/audit-log-model-action.js';
import type { AuditLogModel } from './models/audit-log.model.js';

// An in-memory audit table that round-trips metadata through JSON, like jsonb
const setup = ({ failAppend = false } = {}) => {
  const rows: AuditLogModel[] = [];
  const auditLogModelAction = {
    append: vi.fn(async (build: (prevHash: string | null) => AuditEntry) => {
      if (failAppend) throw new Error('database down');
      const entry = build(rows.at(-1)?.hash ?? null);
      rows.push({ ...entry, id: String(rows.length + 1), metadata: JSON.parse(JSON.stringify(entry.metadata)) as Record<string, unknown> });
    }),
    findAfter: vi.fn(async (id: string, take: number) => rows.filter((r) => Number(r.id) > Number(id)).slice(0, take)),
  };
  const service = new AuditService(auditLogModelAction as unknown as AuditLogModelAction);
  return { service, rows };
};

// Runs work as if inside an HTTP request from this user and IP
const asRequest = (work: () => Promise<void>) =>
  new Promise<void>((resolve, reject) => {
    const req = { ip: '203.0.113.7', user: { id: 'admin-1', role: Role.ADMIN } } as unknown as Request;
    requestContextMiddleware(req, {} as never, () => {
      work().then(resolve, reject);
    });
  });

describe('AuditService', () => {
  it('takes the actor and IP from the current request', async () => {
    const { service, rows } = setup();
    await asRequest(() =>
      service.record({ action: AuditAction.RULE_UPDATED, entityType: 'rule', entityId: 'velocity' }),
    );
    expect(rows[0]).toMatchObject({
      actorId: 'admin-1',
      actorRole: Role.ADMIN,
      ip: '203.0.113.7',
      action: 'rule.updated',
      entityType: 'rule',
      entityId: 'velocity',
      prevHash: '0'.repeat(64),
    });
  });

  it('lets the caller name the actor when no one is signed in yet', async () => {
    const { service, rows } = setup();
    await service.record({ action: AuditAction.LOGIN_FAILED, actorId: null, metadata: { email: 'x@example.com' } });
    expect(rows[0]).toMatchObject({ actorId: null, actorRole: null, ip: null });
  });

  it('chains each entry to the previous one, and verify accepts an untouched log', async () => {
    const { service, rows } = setup();
    await service.record({ action: AuditAction.LOGIN_SUCCEEDED, actorId: 'a' });
    await service.record({ action: AuditAction.REVIEW_DECIDED, metadata: { decision: 'CLEARED', b: 1, a: 2 } });
    await service.record({ action: AuditAction.LOGOUT, actorId: 'a' });
    expect(rows[1].prevHash).toBe(rows[0].hash);
    expect(rows[2].prevHash).toBe(rows[1].hash);
    await expect(service.verify()).resolves.toEqual({ valid: true, checked: 3, firstInvalidId: null });
  });

  it('detects an edited entry', async () => {
    const { service, rows } = setup();
    await service.record({ action: AuditAction.REVIEW_DECIDED, metadata: { decision: 'ESCALATED' } });
    await service.record({ action: AuditAction.LOGOUT });
    rows[0].metadata = { decision: 'CLEARED' };
    await expect(service.verify()).resolves.toEqual({ valid: false, checked: 0, firstInvalidId: '1' });
  });

  it('detects a deleted entry', async () => {
    const { service, rows } = setup();
    for (const action of [AuditAction.LOGIN_SUCCEEDED, AuditAction.RULE_UPDATED, AuditAction.LOGOUT]) {
      await service.record({ action });
    }
    rows.splice(1, 1);
    await expect(service.verify()).resolves.toEqual({ valid: false, checked: 1, firstInvalidId: '3' });
  });

  it('never fails the action being audited', async () => {
    const { service } = setup({ failAppend: true });
    await expect(service.record({ action: AuditAction.LOGOUT })).resolves.toBeUndefined();
  });
});
