import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { RuleType } from './enums/rule-type.enum.js';
import { DetectionRuleModelAction } from './model-actions/detection-rule-model-action.js';
import { DetectionRuleModel } from './models/detection-rule.model.js';
import { RulesService } from './rules.service.js';
import { RuleEvaluatorService } from './services/rule-evaluator.service.js';

const admin = { id: 'admin-1', role: Role.ADMIN } as AuthUser;

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
    createdById: null,
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
    findLatestByKey: vi.fn(async () => current),
    setActive: vi.fn(async () => undefined),
    create: vi.fn(async (data: Partial<DetectionRuleModel>) => ({ id: 'rule-v2', ...data }) as DetectionRuleModel),
  };
  const service = new RulesService(
    dataSource as unknown as DataSource,
    detectionRuleModelAction as unknown as DetectionRuleModelAction,
    new RuleEvaluatorService(),
  );
  return { service, manager, detectionRuleModelAction };
};

describe('RulesService', () => {
  describe('update', () => {
    it('saves a new version and switches the old one off, in one transaction', async () => {
      const { service, manager, detectionRuleModelAction } = setup();
      const saved = await service.update(
        'high-amount-ngn',
        { version: 1, params: { threshold: 750_000, currency: 'NGN' } },
        admin,
      );
      expect(detectionRuleModelAction.setActive).toHaveBeenCalledWith('rule-v1', false, manager);
      expect(detectionRuleModelAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleKey: 'high-amount-ngn',
          version: 2,
          type: RuleType.HIGH_AMOUNT,
          params: { threshold: 750_000, currency: 'NGN' },
          weight: 30,
          isActive: true,
          createdById: 'admin-1',
        }),
        manager,
      );
      expect(saved).toMatchObject({ version: 2, allowedParams: ['threshold', 'currency'], savedBy: 'admin-1' });
    });

    it('keeps a switched-off rule switched off', async () => {
      const { service, detectionRuleModelAction } = setup({ current: highAmount({ isActive: false }) });
      await service.update('high-amount-ngn', { version: 1, weight: 40 }, admin);
      expect(detectionRuleModelAction.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, weight: 40 }),
        expect.anything(),
      );
    });

    it('refuses an edit of an outdated version', async () => {
      await expect(setup({ current: highAmount({ version: 3 }) }).service.update('high-amount-ngn', { version: 2, weight: 40 }, admin)).rejects.toThrow(
        ConflictException,
      );
    });

    it('turns a concurrent save into 409', async () => {
      const duplicate = new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate'), { code: '23505' }));
      await expect(
        setup({ failWith: duplicate }).service.update('high-amount-ngn', { version: 1, weight: 40 }, admin),
      ).rejects.toThrow(new ConflictException('This rule was changed at the same time. Reload and try again'));
    });

    it('rejects parameters the engine cannot run', async () => {
      const { service } = setup();
      await expect(
        service.update('high-amount-ngn', { version: 1, params: { threshold: 'lots' } }, admin),
      ).rejects.toThrow(new BadRequestException('threshold must be a non-negative number'));
      await expect(
        service.update('high-amount-ngn', { version: 1, params: { threshold: 1, script: 'x' } }, admin),
      ).rejects.toThrow(/Unknown parameters for HIGH_AMOUNT: script/);
    });

    it('rejects an edit that changes nothing', async () => {
      await expect(
        setup().service.update('high-amount-ngn', { version: 1, weight: 30, params: { currency: 'NGN', threshold: 500_000 } }, admin),
      ).rejects.toThrow(new BadRequestException('Nothing changed'));
    });

    it('returns 404 for an unknown rule', async () => {
      await expect(setup({ current: null }).service.update('nope', { version: 1, weight: 1 }, admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setActive', () => {
    it('switches the latest version off', async () => {
      const { service, detectionRuleModelAction } = setup();
      await expect(service.setActive('high-amount-ngn', false, admin)).resolves.toMatchObject({ isActive: false });
      expect(detectionRuleModelAction.setActive).toHaveBeenCalledWith('rule-v1', false);
    });

    it('does nothing when already in that state', async () => {
      const { service, detectionRuleModelAction } = setup();
      await service.setActive('high-amount-ngn', true, admin);
      expect(detectionRuleModelAction.setActive).not.toHaveBeenCalled();
    });
  });
});
