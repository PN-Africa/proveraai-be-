import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

const NOT_FOUND = ApiResponse({ status: 404, description: 'Rule not found' });
const RULE = '{ ruleKey, version, name, type, params, allowedParams, weight, isActive, savedAt }';

export class RulesDocs {
  static List() {
    return applyDecorators(
      ApiOperation({
        summary: 'List your detection rules, latest version of each',
        description: 'Every account starts with its own copy of the default rules.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: `[${RULE}]` }),
    );
  }

  static Get() {
    return applyDecorators(
      ApiOperation({ summary: 'Get one of your rules with its version history' }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: `${RULE} plus history, newest first` }),
      NOT_FOUND,
    );
  }

  static Update() {
    return applyDecorators(
      ApiOperation({
        summary: 'Edit one of your rules',
        description:
          'Saves a new version and keeps the old one, so past explanations stay accurate. ' +
          'Send the version you edited; params replaces all parameters. ' +
          'Applies to scoring from now on. Past scores change only through POST /uploads/{id}/rescore.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: `The new version: ${RULE}` }),
      ApiResponse({ status: 400, description: 'Invalid name, weight or parameters, or nothing changed' }),
      NOT_FOUND,
      ApiResponse({ status: 409, description: 'The rule was changed since this version. Reload and retry' }),
    );
  }

  static SetActive(active: boolean) {
    return applyDecorators(
      ApiOperation({
        summary: `${active ? 'Switch on' : 'Switch off'} one of your rules`,
        description: 'Applies to scoring from now on. Does nothing if it is already in that state.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: RULE }),
      NOT_FOUND,
    );
  }
}
