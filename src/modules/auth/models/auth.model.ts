import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { Role } from '../enums/role.enum.js';

// Models live in models/ and are picked up by the data-source glob
// (modules/**/models/*). One class per file, named <Thing>Model.
@Entity('accounts')
export class AccountModel extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string; // store the hash only, never the plain password

  @Column({ type: 'enum', enum: Role, default: Role.ANALYST })
  role!: Role;

  @Column({ default: true })
  isActive!: boolean;
}
