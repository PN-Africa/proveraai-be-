import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { RulesDocs } from './docs/rules.docs.js';
import { UpdateRuleDto } from './dtos/update-rule.dto.js';
import { RuleKeyPipe } from './pipes/rule-key.pipe.js';
import { RulesService } from './rules.service.js';

// Each account sees and changes only its own rules
@ApiTags('rules')
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  @RulesDocs.List()
  list(@CurrentUser() user: AuthUser) {
    return this.rulesService.list(user);
  }

  @Get(':ruleKey')
  @RulesDocs.Get()
  get(@Param('ruleKey', RuleKeyPipe) ruleKey: string, @CurrentUser() user: AuthUser) {
    return this.rulesService.get(ruleKey, user);
  }

  @Patch(':ruleKey')
  @RulesDocs.Update()
  update(
    @Param('ruleKey', RuleKeyPipe) ruleKey: string,
    @Body() dto: UpdateRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rulesService.update(ruleKey, dto, user);
  }

  @Post(':ruleKey/activate')
  @HttpCode(HttpStatus.OK)
  @RulesDocs.SetActive(true)
  activate(@Param('ruleKey', RuleKeyPipe) ruleKey: string, @CurrentUser() user: AuthUser) {
    return this.rulesService.setActive(ruleKey, true, user);
  }

  @Post(':ruleKey/deactivate')
  @HttpCode(HttpStatus.OK)
  @RulesDocs.SetActive(false)
  deactivate(@Param('ruleKey', RuleKeyPipe) ruleKey: string, @CurrentUser() user: AuthUser) {
    return this.rulesService.setActive(ruleKey, false, user);
  }
}
