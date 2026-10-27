import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Append-only record of security-relevant events (AR-24, AR-25). Each row
// holds the hash of the row before it, so editing or deleting any row breaks
// the chain from that point on (AR-26). See AuditService.verify().
@Entity('audit_logs')
export class AuditLogModel {
  // Increasing number: the order of the chain
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Index()
  @Column({ type: 'timestamptz' })
  occurredAt!: Date;

  // Null for anonymous events, such as a failed login for an unknown email
  @Index()
  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  actorRole!: string | null;

  @Index()
  @Column({ length: 64 })
  action!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  entityType!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'char', length: 64 })
  prevHash!: string;

  @Column({ type: 'char', length: 64, unique: true })
  hash!: string;
}
