import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { QuickSalesItemEntity } from './quickSalesItem.entity';
import { DecimalTransformer } from 'src/common/transformers/decimal.transformer';
import { PaymentMethod } from 'src/payments/entities/invoicePayments.entity';

export enum QuickSaleStatus {
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
}

@Entity('quick_sales')
@Index('UQ_BUSINESS_QS_NUMBER', ['businessId', 'quickSaleNumber'], {
  unique: true,
})
@Index('IDX_QS_BUSINESS_DATE', ['businessId', 'createdAt'])
export class QuickSalesEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quick_sale_number', type: 'varchar', length: 50 })
  quickSaleNumber: string;

  @Index('IDX_QS_BUSINESS')
  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
    transformer: new DecimalTransformer(),
  })
  totalAmount: number;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({
    name: 'payment_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  paymentReference?: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: QuickSaleStatus,
    default: QuickSaleStatus.COMPLETED,
  })
  status: QuickSaleStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;

  @ManyToOne(() => BusinessEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessEntity;

  @OneToMany(() => QuickSalesItemEntity, (item) => item.quickSale, {
    cascade: ['insert'],
  })
  items: QuickSalesItemEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @BeforeInsert()
  generateQuickSaleNumber() {
    if (!this.quickSaleNumber && this.business) {
      const prefix = 'QS';
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      this.quickSaleNumber = `${prefix}-${timestamp}${random}`;
    }
  }
}
