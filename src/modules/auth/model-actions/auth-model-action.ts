import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { AccountStatus, MEMBER_STATUSES, MemberStatus } from '../enums/account-status.enum.js';
import { Role } from '../enums/role.enum.js';
import { AccountModel } from '../models/auth.model.js';

// The pending list is for an admin to review; it never needs to be longer
const MAX_PENDING_LISTED = 100;

export interface MemberFilters {
  search?: string;
  status?: MemberStatus;
  role?: Role;
}

// Escapes LIKE wildcards so a search for "a_b" or "50%" matches literally
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class AuthModelAction extends AbstractModel<AccountModel> {
  constructor(
    @InjectRepository(AccountModel)
    private readonly accountRepository: Repository<AccountModel>,
  ) {
    super(accountRepository, AccountModel);
  }

  async findByEmail(email: string): Promise<AccountModel | null> {
    return this.accountRepository.findOne({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        passwordHash: true,
      },
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.accountRepository.exists({ where: { email } });
  }

  async findActiveById(id: string): Promise<AccountModel | null> {
    return this.accountRepository.findOne({
      where: { id, status: AccountStatus.ACTIVE },
    });
  }

  async findPending(): Promise<AccountModel[]> {
    return this.accountRepository.find({
      where: { status: AccountStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: MAX_PENDING_LISTED,
    });
  }

  // Returns false when there is no pending account with this id
  async activatePending(id: string): Promise<boolean> {
    const result = await this.accountRepository.update(
      { id, status: AccountStatus.PENDING },
      { status: AccountStatus.ACTIVE },
    );
    return (result.affected ?? 0) > 0;
  }

  async setLastLoginAt(id: string, at: Date): Promise<void> {
    await this.accountRepository.update(id, { lastLoginAt: at });
  }

  // Approved accounts only; search matches name or email, ignoring case
  findMembers(filters: MemberFilters, page: number, limit: number) {
    const base: FindOptionsWhere<AccountModel> = {
      status: filters.status ?? In([...MEMBER_STATUSES]),
      ...(filters.role && { role: filters.role }),
    };
    const pattern = filters.search ? `%${escapeLike(filters.search)}%` : null;
    const where = pattern
      ? [
          { ...base, fullName: ILike(pattern) },
          { ...base, email: ILike(pattern) },
        ]
      : base;
    return this.findWithPagination(page, limit, {
      where,
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }

  findMemberById(id: string): Promise<AccountModel | null> {
    return this.accountRepository.findOne({
      where: { id, status: In([...MEMBER_STATUSES]) },
    });
  }

  // Changes the status only if it is still `from`; false when it was not
  async changeStatus(id: string, from: AccountStatus, to: AccountStatus): Promise<boolean> {
    const result = await this.accountRepository.update({ id, status: from }, { status: to });
    return (result.affected ?? 0) > 0;
  }
}
