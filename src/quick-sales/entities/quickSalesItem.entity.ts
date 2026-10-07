import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QuickSalesEntity } from './quickSales.entity';
import { DecimalTransformer } from 'src/common/transformers/decimal.transformer';

@Entity('quick_sales_items')
export class QuickSalesItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_name', type: 'varchar', length: 255 })
  itemName: string;

  @Column({ name: 'item_quantity', type: 'int' })
  itemQuantity: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalTransformer(),
  })
  unitPrice: number;

  @Column({
    name: 'total_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new DecimalTransformer(),
  })
  totalPrice: number;

  @ManyToOne(() => QuickSalesEntity, (qs) => qs.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quick_sale_id' })
  quickSale: QuickSalesEntity;
}
