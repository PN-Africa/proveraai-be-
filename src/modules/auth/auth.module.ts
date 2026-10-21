import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthModelAction } from './model-actions/auth-model-action.js';
import { AccountModel } from './models/auth.model.js';
import { TokenService } from './services/token.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AccountModel])],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuthModelAction,
    // Global guard: every route in the app needs a valid token unless it is
    // marked @Public() (see common/decorators/public.decorator.ts)
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService], // what other modules may inject
})
export class AuthModule {}
