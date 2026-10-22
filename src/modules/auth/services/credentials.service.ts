import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus } from '../enums/account-status.enum.js';
import { AuthModelAction } from '../model-actions/auth-model-action.js';
import { AccountModel } from '../models/auth.model.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { PasswordService } from './password.service.js';


@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    private readonly authModelAction: AuthModelAction,
    private readonly passwordService: PasswordService,
    private readonly loginLockoutService: LoginLockoutService,
  ) {}

  async authenticate(email: string, password: string, ip: string | null): Promise<AccountModel> {
    if (await this.loginLockoutService.isLocked(email)) {
      this.logger.warn(`Login refused, account locked: email=${email} ip=${ip}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const account = await this.authModelAction.findByEmail(email);
    const valid = account
      ? await this.passwordService.verify(account.passwordHash, password)
      : (await this.passwordService.verifyDummy(password), false);

    if (!account || !valid) {
      const locked = await this.loginLockoutService.registerFailure(email);
      this.logger.warn(
        `Login failed: email=${email} ip=${ip}${locked ? ' (account now locked)' : ''}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.loginLockoutService.reset(email);
    if (account.status === AccountStatus.PENDING) {
      throw new ForbiddenException('Account pending approval');
    }
    if (account.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return account;
  }
}
