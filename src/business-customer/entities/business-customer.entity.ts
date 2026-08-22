import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { Customer } from 'src/customers/entities/customer.entity';
@Entity('business_customer')
@Unique(['business', 'customer'])
@Index('IDX_BUSINESS_CUSTOMER', ['businessId', 'associatedAt'])
export class BusinessCustomer {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ name: 'business_id' })
  businessId: string;
  @ManyToOne(() => BusinessEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: BusinessEntity; //holds the reference of business entity

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @CreateDateColumn({ name: 'associated_at' })
  associatedAt: Date;
}
