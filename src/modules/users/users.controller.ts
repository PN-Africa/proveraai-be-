import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { UsersDocs } from './docs/users.docs.js';
import { UsersService } from './users.service.js';

// Admin-only account management (scope §9): approving sign-ups
@ApiTags('users')
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('pending')
  @UsersDocs.ListPending()
  listPending() {
    return this.usersService.listPending();
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsersDocs.Approve()
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.usersService.approve(id, admin);
  }
}
