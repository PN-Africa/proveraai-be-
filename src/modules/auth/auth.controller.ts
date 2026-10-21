import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dtos/auth.dto.js';
import { AuthDocs } from './docs/auth.docs.js';

// Controllers only route: take the request in, call the service, return.
// No business logic here.
// Every route here is protected by the global AuthGuard except login, which is
// marked @Public().
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Open to everyone, so it gets a stricter limit than the global one:
  // 5 attempts per minute (security checklist, gate 3)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AuthDocs.Login()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @AuthDocs.Logout()
  logout() {
    return this.authService.logout();
  }

  // The user comes from the guard, never from the request
  @Get('me')
  @AuthDocs.Me()
  me(@CurrentUser() user: unknown) {
    return this.authService.me(user);
  }
}
