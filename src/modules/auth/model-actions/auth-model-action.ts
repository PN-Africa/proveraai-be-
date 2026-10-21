import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { AccountModel } from '../models/auth.model.js';

// Model actions are the only layer that talks to the repository.
// Services call these methods; they never use Repository directly.
@Injectable()
export class AuthModelAction extends AbstractModel<AccountModel> {
  constructor(
    @InjectRepository(AccountModel)
    private readonly accountRepository: Repository<AccountModel>,
  ) {
    super(accountRepository, AccountModel);
  }

  // Entity-specific queries go here (generic CRUD is inherited)
  async findByEmail(email: string): Promise<AccountModel | null> {
    return this.accountRepository.findOne({ where: { email } });
  }
}
