import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { RulesDocs } from './docs/rules.docs.js';
import { UpdateRuleDto } from './dtos/update-rule.dto.js';
import { RuleKeyPipe } from './pipes/rule-key.pipe.js';
import { RulesService } from './rules.service.js';

// Only admins see or change rules: thresholds and weights stay hidden from
// analysts (AR-18, TR-11)
@ApiTags('rules')
@Roles(Role.ADMIN)
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  @RulesDocs.List()
  list() {
    return this.rulesService.list();
  }

  @Get(':ruleKey')
  @RulesDocs.Get()
  get(@Param('ruleKey', RuleKeyPipe) ruleKey: string) {
    return this.rulesService.get(ruleKey);
  }

  @Patch(':ruleKey')
  @RulesDocs.Update()
  update(
    @Param('ruleKey', RuleKeyPipe) ruleKey: string,
    @Body() dto: UpdateRuleDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.rulesService.update(ruleKey, dto, admin);
  }

  @Post(':ruleKey/activate')
  @HttpCode(HttpStatus.OK)
  @RulesDocs.SetActive(true)
  activate(@Param('ruleKey', RuleKeyPipe) ruleKey: string, @CurrentUser() admin: AuthUser) {
    return this.rulesService.setActive(ruleKey, true, admin);
  }

  @Post(':ruleKey/deactivate')
  @HttpCode(HttpStatus.OK)
  @RulesDocs.SetActive(false)
  deactivate(@Param('ruleKey', RuleKeyPipe) ruleKey: string, @CurrentUser() admin: AuthUser) {
    return this.rulesService.setActive(ruleKey, false, admin);
  }
}
