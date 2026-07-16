import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../auth/entities/auth.entity';
import { Customer } from 'src/customers/entities/customer.entity';
@Entity('business')
export class BusinessEntity {
  @PrimaryGeneratedColumn('uuid')
  business_id: string;

  @Column({ name: 'business_name' })
  business_name: string;

  @Column({ name: 'pan_number' })
  panNumber: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'business_wallet_balance',
    default: 0,
  })
  walletBalance: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
  @ManyToOne(() => UserEntity, (user) => user.businesses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'business_owner_id' })
  owner: UserEntity;
}
