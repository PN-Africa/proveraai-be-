import { Injectable, NotImplementedException } from '@nestjs/common';
import { LoginDto } from './dtos/auth.dto.js';
import { AuthModelAction } from './model-actions/auth-model-action.js';
import { TokenService } from './services/token.service.js';

// The service holds business logic. It depends on model actions for data
// access and on sub-services (services/) for focused jobs. This is a skeleton.
// TODO(template): implement
@Injectable()
export class AuthService {
  constructor(
    private readonly authModelAction: AuthModelAction,
    private readonly tokenService: TokenService,
  ) {}

  async login(_dto: LoginDto) {
    throw new NotImplementedException();
  }

  async logout() {
    throw new NotImplementedException();
  }

  async me(_user: unknown) {
    throw new NotImplementedException();
  }
}
