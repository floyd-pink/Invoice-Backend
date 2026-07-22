import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InvoiceEntity } from './invoice.entity';

@Entity('invoice_items')
export class InvoiceItemsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_INVOICE_ITEMS_INVOICE')
  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'item_name', type: 'varchar' })
  itemName: string;

  @Column({ name: 'item_quantity', type: 'int' })
  itemQuantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalUnitPrice: number;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.invoiceItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: InvoiceEntity;
}
