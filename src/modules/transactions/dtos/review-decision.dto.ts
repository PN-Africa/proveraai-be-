import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length } from 'class-validator';
import { ReviewDecision } from '../enums/review-decision.enum.js';

export const MIN_NOTES_LENGTH = 10;
export const MAX_NOTES_LENGTH = 2000;

export class ReviewDecisionDto {
  @ApiProperty({ enum: ReviewDecision })
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  // Required so a decision is never a bare click (TR-14)
  @ApiProperty({
    description: 'What was checked and why this decision',
    minLength: MIN_NOTES_LENGTH,
    maxLength: MAX_NOTES_LENGTH,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(MIN_NOTES_LENGTH, MAX_NOTES_LENGTH)
  notes!: string;
}
