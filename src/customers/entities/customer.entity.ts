import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  customer_id: string;

  @Column({ name: 'customer_name', type: 'varchar' })
  customer_name: string;

  @Column({ type: 'varchar', length: 20, unique: true, name: 'customer_phone' })
  customer_phone: string;

  @Column({
    type: 'varchar',
    unique: true,
    name: 'customer_email',
    nullable: true,
  })
  customer_email: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updated_at: Date;
}
