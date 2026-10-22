import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthModelAction } from './model-actions/auth-model-action.js';
import { RefreshTokenModelAction } from './model-actions/refresh-token-model-action.js';
import { AccountModel } from './models/auth.model.js';
import { RefreshTokenModel } from './models/refresh-token.model.js';
import { AccountService } from './services/account.service.js';
import { AuthCookieService } from './services/auth-cookie.service.js';
import { CredentialsService } from './services/credentials.service.js';
import { LoginLockoutService } from './services/login-lockout.service.js';
import { PasswordService } from './services/password.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { TokenRevocationService } from './services/token-revocation.service.js';
import { JWT_ISSUER, TokenService } from './services/token.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountModel, RefreshTokenModel]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwtAccessSecret'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.getOrThrow<number>('accessTokenTtlMinutes') * 60,
          issuer: JWT_ISSUER,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountService,
    CredentialsService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    TokenRevocationService,
    LoginLockoutService,
    AuthCookieService,
    AuthModelAction,
    RefreshTokenModelAction,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService], // what other modules may inject
})
export class AuthModule {}
