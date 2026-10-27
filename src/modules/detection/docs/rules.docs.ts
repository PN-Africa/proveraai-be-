import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

const ADMIN_ONLY = ApiResponse({ status: 403, description: 'Not an administrator' });
const NOT_FOUND = ApiResponse({ status: 404, description: 'Rule not found' });
const RULE = '{ ruleKey, version, name, type, params, allowedParams, weight, isActive, savedBy, savedAt }';

export class RulesDocs {
  static List() {
    return applyDecorators(
      ApiOperation({ summary: 'List detection rules, latest version of each (admin only)' }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: `[${RULE}]` }),
      ADMIN_ONLY,
    );
  }

  static Get() {
    return applyDecorators(
      ApiOperation({ summary: 'Get a rule with its version history (admin only)' }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: `${RULE} plus history, newest first` }),
      ADMIN_ONLY,
      NOT_FOUND,
    );
  }

  static Update() {
    return applyDecorators(
      ApiOperation({
        summary: 'Edit a rule (admin only)',
        description:
          'Saves a new version and keeps the old one, so past explanations stay accurate. ' +
          'Send the version you edited; params replaces all parameters. ' +
          'Applies to scoring from now on. Past scores change only through POST /uploads/{id}/rescore.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: `The new version: ${RULE}` }),
      ApiResponse({ status: 400, description: 'Invalid name, weight or parameters, or nothing changed' }),
      ADMIN_ONLY,
      NOT_FOUND,
      ApiResponse({ status: 409, description: 'The rule was changed since this version. Reload and retry' }),
    );
  }

  static SetActive(active: boolean) {
    return applyDecorators(
      ApiOperation({
        summary: `${active ? 'Switch on' : 'Switch off'} a rule (admin only)`,
        description: 'Applies to scoring from now on. Does nothing if it is already in that state.',
      }),
      ApiCookieAuth(),
      ApiResponse({ status: 200, description: RULE }),
      ADMIN_ONLY,
      NOT_FOUND,
    );
  }
}
