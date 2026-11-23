import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentProvider } from '../enums/payment-provider.enum';

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  ERROR = 'ERROR',
}

@Entity('payment_transactions')
@Index('IDX_PAYMENT_TRANS_PROVIDER_STATUS', ['provider', 'status'])
@Index('IDX_PAYMENT_TRANS_BUSINESS', ['businessId'])
@Index('IDX_PAYMENT_TRANS_SUBSCRIPTION', ['subscriptionId'])
@Index('UQ_PAYMENT_PROVIDER_REFERENCE', ['provider', 'providerTransactionId'], {
  unique: true,
})
@Index('UQ_PAYMENT_OWNER_REQUEST', ['ownerId', 'requestId'], { unique: true })
export class PaymentTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider', type: 'enum', enum: PaymentProvider })
  provider: PaymentProvider;

  @Column({
    name: 'provider_transaction_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerTransactionId: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'currency', type: 'varchar', length: 3 })
  currency: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'subscription_id', type: 'int', nullable: true })
  subscriptionId: number | null;

  @Column({ name: 'plan_id', type: 'int' })
  planId: number;

  @Column({ name: 'owner_id', type: 'int' })
  ownerId: number;

  @Column({ name: 'request_id', type: 'uuid', nullable: true })
  requestId: string | null;

  @Column({ name: 'checkout_url', type: 'text', nullable: true })
  checkoutUrl: string | null;

  @Column({ name: 'gateway_payload', type: 'jsonb', nullable: true })
  gatewayPayload?: Record<string, any>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
