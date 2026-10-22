import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { AccountModel } from './auth.model.js';

@Entity('refresh_tokens')
export class RefreshTokenModel extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  accountId!: string;

  @ManyToOne(() => AccountModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account?: AccountModel;

  @Column({ type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Index()
  @Column({ type: 'uuid' })
  familyId!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replacedById!: string | null;
}
