import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicePaymentsEntity } from './entities/invoicePayments.entity';
import { InvoiceEntity } from 'src/invoice_items/entities/invoice.entity';
import { InvoiceItemsModule } from 'src/invoice_items/invoice_items.module';
import { PaymentsController } from './payments.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature([InvoicePaymentsEntity, InvoiceEntity]),
    InvoiceItemsModule,
  ],
  providers: [PaymentsService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
