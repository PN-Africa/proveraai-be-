import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Occurred at or after (ISO 8601)', example: '2026-10-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ description: 'Occurred at or before (ISO 8601)', example: '2026-10-31T23:59:59Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
