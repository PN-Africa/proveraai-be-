import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../audit/enums/audit-action.enum.js';
import { AccountStatus } from '../enums/account-status.enum.js';
import { Role } from '../enums/role.enum.js';
import { AuthModelAction } from '../model-actions/auth-model-action.js';
import { AccountModel } from '../models/auth.model.js';
import { Member, toMember } from './member.service.js';
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

export interface PendingAccount {
  id: string;
  fullName: string;
  email: string;
  createdAt: Date;
}

// account has the same shape as a row of GET /users, so the frontend can
// move it from the pending list into the members table without a reload
export interface ApprovedAccount {
  message: string;
  account: Member;
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

  // A pending or deleted account is treated as signed out
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
      status: AccountStatus.PENDING,
      passwordHash: await this.passwordService.hash(password),
    });
    this.logger.log(`Account signed up, pending approval: id=${account.id}`);
    await this.auditService.record({
      action: AuditAction.ACCOUNT_SIGNED_UP,
      actorId: account.id,
      actorRole: account.role,
      entityType: 'account',
      entityId: account.id,
    });
    return this.toProfile(account);
  }

  async listPending(): Promise<PendingAccount[]> {
    const accounts = await this.authModelAction.findPending();
    return accounts.map(({ id, fullName, email, createdAt }) => ({
      id,
      fullName,
      email,
      createdAt,
    }));
  }

  async approve(id: string, adminId: string): Promise<ApprovedAccount> {
    if (!(await this.authModelAction.activatePending(id))) {
      throw new NotFoundException('No pending account with this id');
    }
    this.logger.log(`Account approved: id=${id} by=${adminId}`);
    await this.auditService.record({
      action: AuditAction.ACCOUNT_APPROVED,
      actorId: adminId,
      entityType: 'account',
      entityId: id,
    });
    // Just activated, so it is found unless it was deleted in between
    const account = await this.authModelAction.findActiveById(id);
    if (!account) throw new NotFoundException('No pending account with this id');
    return { message: 'Account approved', account: toMember(account) };
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
