import { DecimalTransformer } from 'src/common/transformers/decimal.transformer';
import { InvoiceEntity } from '../../invoice_items/entities/invoice.entity';

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  ESEWA = 'ESEWA',
  IMEPAY = 'IMEPAY',
  KHALTI = 'KHALTI',
  BANK_TRANSFER = 'BANK_TRANSFER',
}
@Entity('invoice_payments')
export class InvoicePaymentsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id', type: 'varchar', length: 30 })
  paymentId: string;

  @Column({
    name: 'amount_paid',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
    transformer: new DecimalTransformer(),
  })
  amountPaid: number;
  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;
  @Column({
    name: 'payment_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  paymentReference?: string;
  @Column({ name: 'received_at', type: 'timestamp' })
  receivedAt: Date;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.invoicePayments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: InvoiceEntity; //this provides whole invoice object so we can get customerId and businessId from invoice object
}
