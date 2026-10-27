import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { DataSource, QueryFailedError } from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { UpdateRuleDto } from './dtos/update-rule.dto.js';
import { DetectionRuleModelAction } from './model-actions/detection-rule-model-action.js';
import { DetectionRuleModel } from './models/detection-rule.model.js';
import { PARAM_KEYS, RuleEvaluatorService } from './services/rule-evaluator.service.js';

const UNIQUE_VIOLATION = '23505';

const toRuleView = (rule: DetectionRuleModel) => ({
  ruleKey: rule.ruleKey,
  version: rule.version,
  name: rule.name,
  type: rule.type,
  params: rule.params,
  allowedParams: PARAM_KEYS[rule.type],
  weight: rule.weight,
  isActive: rule.isActive,
  savedBy: rule.createdById,
  savedAt: rule.createdAt,
});

// Admin management of detection rules (AR-18). Editing saves a new version,
// so indicators keep pointing at the exact version that fired. Changes apply
// to scoring from now on; past scores change only through a manual rescore.
@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly detectionRuleModelAction: DetectionRuleModelAction,
    private readonly ruleEvaluatorService: RuleEvaluatorService,
  ) {}

  async list() {
    return (await this.detectionRuleModelAction.findLatest()).map(toRuleView);
  }

  async get(ruleKey: string) {
    const versions = await this.detectionRuleModelAction.findVersions(ruleKey);
    if (versions.length === 0) throw new NotFoundException('Rule not found');
    return { ...toRuleView(versions[0]), history: versions.map(toRuleView) };
  }

  async update(ruleKey: string, dto: UpdateRuleDto, admin: AuthUser) {
    const current = await this.latest(ruleKey);
    if (dto.version !== current.version) {
      throw new ConflictException(
        `This rule was changed since you loaded it (now version ${current.version}). Reload and try again`,
      );
    }
    const next = {
      name: dto.name ?? current.name,
      params: dto.params ?? current.params,
      weight: dto.weight ?? current.weight,
    };
    if (
      next.name === current.name &&
      next.weight === current.weight &&
      isDeepStrictEqual(next.params, current.params)
    ) {
      throw new BadRequestException('Nothing changed');
    }
    try {
      this.ruleEvaluatorService.validate(current.type, next.params);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid parameters');
    }

    let saved: DetectionRuleModel;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        await this.detectionRuleModelAction.setActive(current.id, false, manager);
        return this.detectionRuleModelAction.create(
          {
            ruleKey,
            version: current.version + 1,
            type: current.type,
            isActive: current.isActive,
            createdById: admin.id,
            ...next,
          },
          manager,
        );
      });
    } catch (err) {
      // Another admin saved the same version first
      if (err instanceof QueryFailedError && (err.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('This rule was changed at the same time. Reload and try again');
      }
      throw err;
    }
    this.logger.log(
      `Rule ${ruleKey} v${current.version} -> v${saved.version} by=${admin.id}: ` +
        JSON.stringify({ before: { name: current.name, params: current.params, weight: current.weight }, after: next }),
    );
    return toRuleView(saved);
  }

  async setActive(ruleKey: string, isActive: boolean, admin: AuthUser) {
    const current = await this.latest(ruleKey);
    if (current.isActive !== isActive) {
      await this.detectionRuleModelAction.setActive(current.id, isActive);
      this.logger.log(`Rule ${ruleKey} v${current.version} ${isActive ? 'activated' : 'deactivated'} by=${admin.id}`);
      current.isActive = isActive;
    }
    return toRuleView(current);
  }

  private async latest(ruleKey: string): Promise<DetectionRuleModel> {
    const rule = await this.detectionRuleModelAction.findLatestByKey(ruleKey);
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }
}
