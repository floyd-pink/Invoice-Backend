import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { InvoiceItemsEntity } from './invoiceItems.entity';
import { InvoicePaymentsEntity } from './invoicePayments.entity';
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

@Entity('invoices')
@Index('UQ_BUSINESS_INVOICE_NUMBER', ['businessId', 'invoiceNumber'], {
  unique: true,
})
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @Index('IDX_INVOICE_BUSINESS')
  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Index('IDX_INVOICE_CUSTOMER')
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  totalAmount: number;

  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  paidAmount: number;

  @Column({
    name: 'due_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  dueAmount: number;

  @Column({ name: 'invoice_date', type: 'date', default: () => 'CURRENT_DATE' })
  invoiceDate: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => BusinessEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessEntity;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @OneToMany(() => InvoiceItemsEntity, (invoiceItem) => invoiceItem.invoice, {
    cascade: ['insert', 'update'],
  })
  invoiceItems: InvoiceItemsEntity[];
  @OneToMany(
    () => InvoicePaymentsEntity,
    (invoicePayment) => invoicePayment.invoice,
  )
  invoicePayments: InvoicePaymentsEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  generateInvoiceNumber() {
    if (!this.invoiceNumber && this.business) {
      const prefix = this.business.business_name
        .replace(/[^a-zA-Z]/g, '')
        .substring(0, 2)
        .toUpperCase();
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      this.invoiceNumber = `${prefix}-${timestamp}${random}`;
    }

    if (!this.invoiceDate) {
      this.invoiceDate = new Date();
    }

    if (!this.dueDate) {
      const due = new Date();
      due.setDate(due.getDate() + 30);
      this.dueDate = due;
    }
  }
}
