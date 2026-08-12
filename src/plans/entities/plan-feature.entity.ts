import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { PlanEntity } from './plan.entity';
import { PlanFeature, LimitPeriod } from '../enum/plan-feature.enum';
@Entity('plan_features')
@Unique(['planId', 'feature'])
export class PlanFeatureEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'plan_id' })
  planId: number;

  @ManyToOne(() => PlanEntity, (plan) => plan.features, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_id' })
  plan: PlanEntity;

  @Column({
    type: 'enum',
    enum: PlanFeature,
  })
  feature: PlanFeature;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ type: 'int', nullable: true })
  limit: number | null; //how much

  @Column({
    type: 'enum',
    enum: LimitPeriod,
    default: LimitPeriod.NONE,
  })
  limitPeriod: LimitPeriod;
}
