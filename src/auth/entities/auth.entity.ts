// src/auth/entities/auth.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
} from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
export type UserRole = 'admin' | 'user' | 'merchant' | 'staff';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column()
  passwordHash: string;

  password?: string;

  @BeforeInsert()
  async hashPassword() {
    if (this.password) {
      const saltRounds = 10;
      this.passwordHash = await bcrypt.hash(this.password, saltRounds);
    }
  }
  @BeforeUpdate()
  async hashPasswordOnUpdate() {
    if (this.password) {
      const saltRounds = 10;
      this.passwordHash = await bcrypt.hash(this.password, saltRounds);
    }
  }

  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ type: 'varchar', default: 'user' })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => BusinessEntity, (business) => business.owner)
  businesses: BusinessEntity[];
}
