import { Test, TestingModule } from '@nestjs/testing';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: {} }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // AR-18 / AR-20: the global AuthGuard rejects analysts on admin-only
  // controllers (see auth.guard.spec.ts); this pins the controller as one
  it('is restricted to administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([Role.ADMIN]);
  });
});
