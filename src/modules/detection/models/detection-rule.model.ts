import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { RuleType } from '../enums/rule-type.enum.js';

// One rule of a built-in type with its own parameters and weight, owned by
// one account. Editing a rule adds a new version under the same ruleKey.
@Entity('detection_rules')
@Index(['ownerId', 'ruleKey', 'version'], { unique: true })
export class DetectionRuleModel extends BaseEntity {
  // The account whose transactions this rule scores
  @Index()
  @Column({ type: 'uuid' })
  ownerId!: string;

  @Column({ length: 64 })
  ruleKey!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'enum', enum: RuleType })
  type!: RuleType;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  params!: Record<string, unknown>;

  // Points added to the risk score when the rule fires
  @Column({ type: 'int' })
  weight!: number;

  // Only the latest version of a rule can be active
  @Column({ default: true })
  isActive!: boolean;
}
