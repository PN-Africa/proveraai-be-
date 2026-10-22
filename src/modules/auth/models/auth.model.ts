import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { AccountStatus } from '../enums/account-status.enum.js';
import { Role } from '../enums/role.enum.js';

@Entity('accounts')
export class AccountModel extends BaseEntity {
  @Column({ length: 100 })
  fullName!: string;

  @Column({ unique: true })
  email!: string;

  
  @Column({ select: false })
  passwordHash!: string;

  @Column({ type: 'enum', enum: Role, default: Role.ANALYST })
  role!: Role;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.PENDING })
  status!: AccountStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;
}
