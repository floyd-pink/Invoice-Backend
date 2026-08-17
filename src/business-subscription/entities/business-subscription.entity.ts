import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { PlanEntity } from 'src/plans/entities/plan.entity';
import { PlanBillingCycle } from 'src/plans/enum/plan-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('business_subscription')
export class BusinessSubscriptionEntity {
  @PrimaryGeneratedColumn()
  subscriptionId: number;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => BusinessEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessEntity;

  @Column({ name: 'plan_id' })
  planId: number;

  @ManyToOne(() => PlanEntity)
  @JoinColumn({ name: 'plan_id' })
  plan: PlanEntity;

  @Column({ name: 'subscription_type', type: 'enum', enum: PlanBillingCycle })
  subscriptionType: PlanBillingCycle;

  @Column({ name: 'status', type: 'enum', enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @Column({ name: 'start_date', type: 'timestamp' })
  startsAt: Date;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'next_billing_date', type: 'timestamp', nullable: true })
  nextBillingDate: Date | null;

  @Column({ name: 'last_billing_date', type: 'timestamp', nullable: true })
  lastBillingDate: Date | null;
  @Column({
    name: 'next_payment_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  nextPaymentAmount: number | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
