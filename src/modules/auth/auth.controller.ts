import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto, SignupDto } from './dtos/auth.dto.js';
import { AuthDocs } from './docs/auth.docs.js';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Creates a pending analyst account; an admin must approve it before it
  // can log in. Open to everyone, so it gets a strict limit per IP.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @Post('signup')
  @AuthDocs.Signup()
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // 5 attempts per minute per IP, plus a per-account lockout
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AuthDocs.Login()
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, req, res);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @AuthDocs.Refresh()
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refresh(req, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @AuthDocs.Logout()
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.logout(req, res);
  }

  // The user comes from the guard, never from the request
  @Get('me')
  @AuthDocs.Me()
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }
}
