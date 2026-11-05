import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { AccountStatus } from '../enums/account-status.enum.js';
import { AccountModel } from '../models/auth.model.js';

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

  async setLastLoginAt(id: string, at: Date): Promise<void> {
    await this.accountRepository.update(id, { lastLoginAt: at });
  }
}
