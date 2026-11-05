import { AuditService } from '../audit/audit.service.js';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { RuleType } from './enums/rule-type.enum.js';
import { DetectionRuleModelAction } from './model-actions/detection-rule-model-action.js';
import { DetectionRuleModel } from './models/detection-rule.model.js';
import { RulesService } from './rules.service.js';
import { RuleEvaluatorService } from './services/rule-evaluator.service.js';

const owner = { id: 'owner-1', role: Role.ANALYST } as AuthUser;

const highAmount = (overrides: Partial<DetectionRuleModel> = {}) =>
  ({
    id: 'rule-v1',
    ruleKey: 'high-amount-ngn',
    version: 1,
    name: 'High-value transaction (NGN)',
    type: RuleType.HIGH_AMOUNT,
    params: { threshold: 500_000, currency: 'NGN' },
    weight: 30,
    isActive: true,
    ownerId: 'owner-1',
    createdAt: new Date('2026-10-20T09:00:00Z'),
    updatedAt: new Date('2026-10-20T09:00:00Z'),
    ...overrides,
  }) as DetectionRuleModel;

const setup = ({ current = highAmount() as DetectionRuleModel | null, failWith = null as Error | null } = {}) => {
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: vi.fn(async (work: (m: EntityManager) => Promise<unknown>) => {
      if (failWith) throw failWith;
      return work(manager);
    }),
  };
  const detectionRuleModelAction = {
    ensureDefaults: vi.fn(async () => undefined),
    findLatestByKey: vi.fn(async () => current),
    setActive: vi.fn(async () => undefined),
    create: vi.fn(async (data: Partial<DetectionRuleModel>) => ({ id: 'rule-v2', ...data }) as DetectionRuleModel),
  };
  const auditService = { record: vi.fn(async () => undefined) };
  const service = new RulesService(
    dataSource as unknown as DataSource,
    detectionRuleModelAction as unknown as DetectionRuleModelAction,
    new RuleEvaluatorService(),
    auditService as unknown as AuditService,
  );
  return { service, manager, detectionRuleModelAction, auditService };
};

describe('RulesService', () => {
  describe('update', () => {
    it('saves a new version and switches the old one off, in one transaction', async () => {
      const { service, manager, detectionRuleModelAction } = setup();
      const saved = await service.update(
        'high-amount-ngn',
        { version: 1, params: { threshold: 750_000, currency: 'NGN' } },
        owner,
      );
      expect(detectionRuleModelAction.setActive).toHaveBeenCalledWith('rule-v1', false, manager);
      expect(detectionRuleModelAction.findLatestByKey).toHaveBeenCalledWith('owner-1', 'high-amount-ngn');
      expect(detectionRuleModelAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'owner-1',
          ruleKey: 'high-amount-ngn',
          version: 2,
          type: RuleType.HIGH_AMOUNT,
          params: { threshold: 750_000, currency: 'NGN' },
          weight: 30,
          isActive: true,
        }),
        manager,
      );
      expect(saved).toMatchObject({ version: 2, allowedParams: ['threshold', 'currency'] });
    });

    it('audits the change with before and after values (AR-25)', async () => {
      const { service, auditService } = setup();
      await service.update('high-amount-ngn', { version: 1, weight: 40 }, owner);
      expect(auditService.record).toHaveBeenCalledWith({
        action: 'rule.updated',
        entityType: 'rule',
        entityId: 'high-amount-ngn',
        metadata: expect.objectContaining({
          fromVersion: 1,
          toVersion: 2,
          before: expect.objectContaining({ weight: 30 }),
          after: expect.objectContaining({ weight: 40 }),
        }) as unknown,
      });
    });

    it('keeps a switched-off rule switched off', async () => {
      const { service, detectionRuleModelAction } = setup({ current: highAmount({ isActive: false }) });
      await service.update('high-amount-ngn', { version: 1, weight: 40 }, owner);
      expect(detectionRuleModelAction.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, weight: 40 }),
        expect.anything(),
      );
    });

    it('refuses an edit of an outdated version', async () => {
      await expect(setup({ current: highAmount({ version: 3 }) }).service.update('high-amount-ngn', { version: 2, weight: 40 }, owner)).rejects.toThrow(
        ConflictException,
      );
    });

    it('turns a concurrent save into 409', async () => {
      const duplicate = new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate'), { code: '23505' }));
      await expect(
        setup({ failWith: duplicate }).service.update('high-amount-ngn', { version: 1, weight: 40 }, owner),
      ).rejects.toThrow(new ConflictException('This rule was changed at the same time. Reload and try again'));
    });

    it('rejects parameters the engine cannot run', async () => {
      const { service } = setup();
      await expect(
        service.update('high-amount-ngn', { version: 1, params: { threshold: 'lots' } }, owner),
      ).rejects.toThrow(new BadRequestException('threshold must be a non-negative number'));
      await expect(
        service.update('high-amount-ngn', { version: 1, params: { threshold: 1, script: 'x' } }, owner),
      ).rejects.toThrow(/Unknown parameters for HIGH_AMOUNT: script/);
    });

    it('rejects an edit that changes nothing', async () => {
      await expect(
        setup().service.update('high-amount-ngn', { version: 1, weight: 30, params: { currency: 'NGN', threshold: 500_000 } }, owner),
      ).rejects.toThrow(new BadRequestException('Nothing changed'));
    });

    it('returns 404 for an unknown rule', async () => {
      await expect(setup({ current: null }).service.update('nope', { version: 1, weight: 1 }, owner)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setActive', () => {
    it('switches the latest version off', async () => {
      const { service, detectionRuleModelAction } = setup();
      await expect(service.setActive('high-amount-ngn', false, owner)).resolves.toMatchObject({ isActive: false });
      expect(detectionRuleModelAction.setActive).toHaveBeenCalledWith('rule-v1', false);
    });

    it('does nothing when already in that state', async () => {
      const { service, detectionRuleModelAction } = setup();
      await service.setActive('high-amount-ngn', true, owner);
      expect(detectionRuleModelAction.setActive).not.toHaveBeenCalled();
    });
  });
});
