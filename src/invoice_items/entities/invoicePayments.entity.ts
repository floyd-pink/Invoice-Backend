import { InvoiceEntity } from './invoice.entity';

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
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
@Index('IDX_PAYMENT_BUSINESS', ['businessId', 'invoiceId'])
export class InvoicePaymentsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id', type: 'varchar', length: 30 })
  paymentId: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;
  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({
    name: 'amount_paid',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  amountPaid: number;
  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;
  @Column({ name: 'payment_reference', type: 'varchar', length: 255 })
  paymentReference?: string;
  @Column({ name: 'payment_date', type: 'timestamp' })
  paymentDate: Date;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.invoicePayments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: InvoiceEntity;
}
