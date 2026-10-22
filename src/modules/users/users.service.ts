import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AuthService } from '../auth/auth.service.js';


@Injectable()
export class UsersService {
  constructor(private readonly authService: AuthService) {}

  listPending() {
    return this.authService.listPendingAccounts();
  }

  approve(id: string, admin: AuthUser) {
    return this.authService.approveAccount(id, admin.id);
  }
}
