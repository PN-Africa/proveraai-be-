import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../audit/enums/audit-action.enum.js';
import { AccountStatus, MemberStatus } from '../enums/account-status.enum.js';
import { Role } from '../enums/role.enum.js';
import { AuthModelAction, MemberFilters } from '../model-actions/auth-model-action.js';
import { AccountModel } from '../models/auth.model.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { TokenRevocationService } from './token-revocation.service.js';

export interface Member {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: AccountStatus;
  // Last sign-in; null if the member has never signed in
  lastActive: Date | null;
  createdAt: Date;
}

export const toMember = (account: AccountModel): Member => ({
  id: account.id,
  fullName: account.fullName,
  email: account.email,
  role: account.role,
  status: account.status,
  lastActive: account.lastLoginAt,
  createdAt: account.createdAt,
});

// Workspace members (approved accounts) as seen by an admin: list, view,
// and switch an account off or back on
@Injectable()
export class MemberService {
  private readonly logger = new Logger(MemberService.name);

  constructor(
    private readonly authModelAction: AuthModelAction,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly tokenRevocationService: TokenRevocationService,
    private readonly auditService: AuditService,
  ) {}

  async list(filters: MemberFilters, page: number, limit: number) {
    const result = await this.authModelAction.findMembers(filters, page, limit);
    return { ...result, data: result.data.map(toMember) };
  }

  async get(id: string): Promise<Member> {
    return toMember(await this.findOrThrow(id));
  }

  async setStatus(id: string, status: MemberStatus, adminId: string): Promise<Member> {
    if (id === adminId) {
      throw new BadRequestException('You cannot change the status of your own account');
    }
    const account = await this.findOrThrow(id);
    if (account.status === status) return toMember(account);

    if (!(await this.authModelAction.changeStatus(id, account.status, status))) {
      throw new ConflictException('This account was changed at the same time. Reload and try again');
    }
    if (status === AccountStatus.DEACTIVATED) {
      // Login and refresh already refuse a deactivated account; this also
      // ends the access tokens it holds now instead of in up to 15 minutes
      await this.refreshTokenService.revokeAllForAccount(id);
      await this.tokenRevocationService.revokeAllForAccount(id);
    }

    this.logger.log(`Account ${status.toLowerCase()}: id=${id} by=${adminId}`);
    await this.auditService.record({
      action:
        status === AccountStatus.DEACTIVATED
          ? AuditAction.ACCOUNT_DEACTIVATED
          : AuditAction.ACCOUNT_REACTIVATED,
      actorId: adminId,
      entityType: 'account',
      entityId: id,
      metadata: { from: account.status, to: status },
    });
    return { ...toMember(account), status };
  }

  private async findOrThrow(id: string): Promise<AccountModel> {
    const account = await this.authModelAction.findMemberById(id);
    if (!account) throw new NotFoundException('Member not found');
    return account;
  }
}
