import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AuthService } from '../auth/auth.service.js';
import { Role } from '../auth/enums/role.enum.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  it('approves an account on behalf of the calling admin', async () => {
    const authService = { approveAccount: vi.fn(async () => undefined) };
    const service = new UsersService(authService as unknown as AuthService);
    const admin = { id: 'admin-1', role: Role.ADMIN } as AuthUser;

    await service.approve('account-1', admin);

    expect(authService.approveAccount).toHaveBeenCalledWith('account-1', 'admin-1');
  });
});
