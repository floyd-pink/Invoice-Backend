import { Entity,OneToMany } from 'typeorm';
import { Column, PrimaryGeneratedColumn } from 'typeorm';
import { PlanBillingCycle, PlanStatus, PlanType } from '../enum/plan-type.enum';
import { PlanFeatureEntity } from './plan-feature.entity';
@Entity('plans')
export class PlanEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: PlanType, default: PlanType.FREE })
  type: PlanType;
  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  name: string;

  @Column({ type: 'boolean', default: true })
  isActive: PlanStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  price: number;
  @Column({
    type: 'enum',
    enum: PlanBillingCycle,
    default: PlanBillingCycle.MONTHLY,
  })
  billingCycle: PlanBillingCycle;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
  @OneToMany(() => PlanFeatureEntity, (planFeature) => planFeature.plan, {
    cascade: true,
  })
  features: PlanFeatureEntity[];
}
