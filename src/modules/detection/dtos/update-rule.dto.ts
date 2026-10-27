import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateRuleDto {
  // The version the admin edited, so two admins cannot overwrite each other
  @ApiProperty({ description: 'The current version, as returned by GET /rules', minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Replaces all parameters. Allowed keys depend on the rule type (see GET /rules)',
    example: { threshold: 500000, currency: 'NGN' },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Points added to the risk score when the rule fires', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  weight?: number;
}
