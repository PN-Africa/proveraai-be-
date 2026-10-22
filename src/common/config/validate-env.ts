import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvVar {
  @IsNumber()
  PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_TYPE: string;

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsNumber()
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

  @IsOptional()
  @IsString()
  ALLOWED_ORIGINS?: string;

  @IsOptional()
  @IsString()
  OBSERVE_APP_KEY?: string;

  @IsOptional()
  @IsString()
  OBSERVE_APP_SECRET?: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  ACCESS_TOKEN_TTL_MINUTES?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  REFRESH_TOKEN_TTL_DAYS?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  COOKIE_SECURE?: string;

  @IsOptional()
  @IsIn(['lax', 'strict', 'none'])
  COOKIE_SAMESITE?: string;

  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  // Number of proxies in front of the app, so request.ip is the real client
  @IsOptional()
  @IsInt()
  @Min(0)
  TRUST_PROXY?: number;

  // First administrator, created on startup while no admin exists
  @IsOptional()
  @IsEmail()
  ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  @Length(12, 128)
  ADMIN_PASSWORD?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  ADMIN_FULL_NAME?: string;
}

export const validate = (config: Record<string, unknown>): EnvVar => {
  const validateEnv = plainToInstance(EnvVar, config, {
    enableImplicitConversion: true,
  });
  const err = validateSync(validateEnv, { skipMissingProperties: false });
  if (err.length > 0) {
    throw new Error(err.toString());
  }
  // Browsers reject SameSite=None cookies that are not Secure
  if (validateEnv.COOKIE_SAMESITE === 'none' && validateEnv.COOKIE_SECURE === 'false') {
    throw new Error('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
  }
  return validateEnv;
};
