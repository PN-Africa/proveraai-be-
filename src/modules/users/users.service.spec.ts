import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AuthService } from '../auth/auth.service.js';
import { AccountStatus } from '../auth/enums/account-status.enum.js';
import { Role } from '../auth/enums/role.enum.js';
import { UsersService } from './users.service.js';

const admin = { id: 'admin-1', role: Role.ADMIN } as AuthUser;

const setup = () => {
  const authService = {
    approveAccount: vi.fn(async () => undefined),
    listMembers: vi.fn(async () => undefined),
    setMemberStatus: vi.fn(async () => ({ id: 'account-1', status: AccountStatus.DEACTIVATED })),
  };
  return { authService, service: new UsersService(authService as unknown as AuthService) };
};

describe('UsersService', () => {
  it('approves an account on behalf of the calling admin', async () => {
    const { service, authService } = setup();
    await service.approve('account-1', admin);
    expect(authService.approveAccount).toHaveBeenCalledWith('account-1', 'admin-1');
  });

  it('lists members with filters and default paging', async () => {
    const { service, authService } = setup();
    await service.listMembers({ search: 'ada', status: AccountStatus.ACTIVE });
    expect(authService.listMembers).toHaveBeenCalledWith(
      { search: 'ada', status: AccountStatus.ACTIVE, role: undefined },
      1,
      20,
    );
  });

  it('deactivates on behalf of the calling admin and says so', async () => {
    const { service, authService } = setup();
    await expect(service.deactivate('account-1', admin)).resolves.toEqual({
      message: 'Account deactivated',
      account: { id: 'account-1', status: AccountStatus.DEACTIVATED },
    });
    expect(authService.setMemberStatus).toHaveBeenCalledWith('account-1', AccountStatus.DEACTIVATED, 'admin-1');
  });
});
