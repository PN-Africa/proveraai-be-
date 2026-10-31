import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { UsersDocs } from './docs/users.docs.js';
import { ListMembersQueryDto } from './dtos/list-members-query.dto.js';
import { UpdateMemberStatusDto } from './dtos/update-member-status.dto.js';
import { UsersService } from './users.service.js';

// Admin-only account management (scope §9): approving sign-ups and
// managing workspace members
@ApiTags('users')
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UsersDocs.ListMembers()
  listMembers(@Query() query: ListMembersQueryDto) {
    return this.usersService.listMembers(query);
  }

  @Get('pending')
  @UsersDocs.ListPending()
  listPending() {
    return this.usersService.listPending();
  }

  @Get(':id')
  @UsersDocs.GetMember()
  getMember(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getMember(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @UsersDocs.Approve()
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.usersService.approve(id, admin);
  }

  @Patch(':id/status')
  @UsersDocs.SetStatus()
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberStatusDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.usersService.setStatus(id, dto.status, admin);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @UsersDocs.Deactivate()
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.usersService.deactivate(id, admin);
  }
}
