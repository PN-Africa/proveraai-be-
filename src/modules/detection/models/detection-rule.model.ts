import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.model.js';
import { RuleType } from '../enums/rule-type.enum.js';

// One rule of a built-in type with its own parameters and weight.
// Editing a rule adds a new version under the same ruleKey.
@Entity('detection_rules')
@Index(['ruleKey', 'version'], { unique: true })
export class DetectionRuleModel extends BaseEntity {
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

  @Column({ default: true })
  isActive!: boolean;
}
