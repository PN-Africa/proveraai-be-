import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AuthService } from '../auth/auth.service.js';
import { AccountStatus, type MemberStatus } from '../auth/enums/account-status.enum.js';
import { ListMembersQueryDto } from './dtos/list-members-query.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly authService: AuthService) {}

  listPending() {
    return this.authService.listPendingAccounts();
  }

  approve(id: string, admin: AuthUser) {
    return this.authService.approveAccount(id, admin.id);
  }

  listMembers({ search, status, role, page, limit }: ListMembersQueryDto) {
    return this.authService.listMembers({ search, status, role }, page ?? 1, limit ?? 20);
  }

  getMember(id: string) {
    return this.authService.getMember(id);
  }

  setStatus(id: string, status: MemberStatus, admin: AuthUser) {
    return this.authService.setMemberStatus(id, status, admin.id);
  }

  async deactivate(id: string, admin: AuthUser) {
    const account = await this.authService.setMemberStatus(id, AccountStatus.DEACTIVATED, admin.id);
    return { message: 'Account deactivated', account };
  }
}
