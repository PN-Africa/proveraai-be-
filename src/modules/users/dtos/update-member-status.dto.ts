import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { MEMBER_STATUSES, type MemberStatus } from '../../auth/enums/account-status.enum.js';

export class UpdateMemberStatusDto {
  @ApiProperty({ enum: MEMBER_STATUSES })
  @IsIn(MEMBER_STATUSES)
  status!: MemberStatus;
}
