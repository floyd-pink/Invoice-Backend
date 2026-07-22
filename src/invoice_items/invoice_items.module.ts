import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceItemsController } from './invoice_items.controller';
import { InvoiceItemsService } from './invoice_items.service';
import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity';
import { BusinessCustomer } from 'src/business-customer/entities/business-customer.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceItemsEntity } from './entities/invoiceItems.entity';
import { InvoicePaymentsEntity } from './entities/invoicePayments.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessEntity,
      BusinessCustomer,
      InvoiceEntity,
      InvoiceItemsEntity,
      InvoicePaymentsEntity,
    ]),
  ],
  controllers: [InvoiceItemsController],
  providers: [InvoiceItemsService],
  exports: [InvoiceItemsService],
})
export class InvoiceItemsModule {}
