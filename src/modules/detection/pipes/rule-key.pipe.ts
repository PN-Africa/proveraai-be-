import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const RULE_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/;

@Injectable()
export class RuleKeyPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!RULE_KEY.test(value)) throw new BadRequestException('Invalid rule key');
    return value;
  }
}
