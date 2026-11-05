import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../audit/enums/audit-action.enum.js';
import { AccountStatus } from '../enums/account-status.enum.js';
import { Role } from '../enums/role.enum.js';
import { AuthModelAction } from '../model-actions/auth-model-action.js';
import { AccountModel } from '../models/auth.model.js';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PasswordService,
} from './password.service.js';

export interface AccountProfile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
}

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly authModelAction: AuthModelAction,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
  ) {}

  findActive(id: string): Promise<AccountModel | null> {
    return this.authModelAction.findActiveById(id);
  }

  // A deactivated or deleted account is treated as signed out
  async getActiveProfile(id: string): Promise<AccountProfile> {
    const account = await this.authModelAction.findActiveById(id);
    if (!account) throw new UnauthorizedException();
    return this.toProfile(account);
  }

  recordLogin(id: string): Promise<void> {
    return this.authModelAction.setLastLoginAt(id, new Date());
  }

  async signup({ fullName, email, password }: SignupInput): Promise<AccountProfile> {
    const normalizedEmail = email.trim().toLowerCase();
    // The DTO already checks this; repeated so the service never relies on it
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`,
      );
    }
    if (await this.authModelAction.existsByEmail(normalizedEmail)) {
      throw new ConflictException('An account with this email already exists');
    }

    const account = await this.authModelAction.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      role: Role.ANALYST,
      // No approval step: every account works on its own data only
      status: AccountStatus.ACTIVE,
      passwordHash: await this.passwordService.hash(password),
    });
    this.logger.log(`Account signed up: id=${account.id}`);
    await this.auditService.record({
      action: AuditAction.ACCOUNT_SIGNED_UP,
      actorId: account.id,
      actorRole: account.role,
      entityType: 'account',
      entityId: account.id,
    });
    return this.toProfile(account);
  }

  toProfile(account: AccountModel): AccountProfile {
    return {
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      role: account.role,
    };
  }
}
