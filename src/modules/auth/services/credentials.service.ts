import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../audit/enums/audit-action.enum.js';
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
    private readonly auditService: AuditService,
  ) {}

  async authenticate(email: string, password: string, ip: string | null): Promise<AccountModel> {
    if (await this.loginLockoutService.isLocked(email)) {
      this.logger.warn(`Login refused, account locked: email=${email} ip=${ip}`);
      await this.auditService.record({ action: AuditAction.LOGIN_LOCKED, actorId: null, metadata: { email } });
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
      await this.auditService.record({
        action: AuditAction.LOGIN_FAILED,
        actorId: account?.id ?? null,
        actorRole: account?.role ?? null,
        metadata: { email, lockedNow: locked },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.loginLockoutService.reset(email);
    if (account.status === AccountStatus.PENDING) {
      await this.auditService.record({
        action: AuditAction.LOGIN_PENDING,
        actorId: account.id,
        actorRole: account.role,
      });
      throw new ForbiddenException('Account pending approval');
    }
    if (account.status === AccountStatus.DEACTIVATED) {
      await this.auditService.record({
        action: AuditAction.LOGIN_DEACTIVATED,
        actorId: account.id,
        actorRole: account.role,
      });
      throw new ForbiddenException('Account deactivated. Contact an administrator');
    }
    if (account.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return account;
  }
}
