import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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
}

export const validate = (config: Record<string, unknown>): EnvVar => {
  const validateEnv = plainToInstance(EnvVar, config, {
    enableImplicitConversion: true,
  });
  const err = validateSync(validateEnv, { skipMissingProperties: false });
  if (err.length > 0) {
    throw new Error(err.toString());
  }
  return validateEnv;
};
