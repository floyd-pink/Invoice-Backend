import { Module } from '@nestjs/common';
import { BusinessCustomerService } from './business-customer.service';
import { BusinessCustomerController } from './business-customer.controller';
import { BusinessCustomer } from './entities/business-customer.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
@Module({
  imports: [TypeOrmModule.forFeature([BusinessCustomer])],
  exports: [TypeOrmModule],
  controllers: [BusinessCustomerController],
  providers: [BusinessCustomerService],
})
export class BusinessCustomerModule {}
