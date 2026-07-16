import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { Customer } from './entities/customer.entity';
import { BusinessCustomerModule } from 'src/business-customer/business-customer.module';
import { TypeOrmModule } from '@nestjs/typeorm';
@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, BusinessEntity]),
    BusinessCustomerModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
