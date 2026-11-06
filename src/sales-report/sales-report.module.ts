import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceEntity } from 'src/invoice_items/entities/invoice.entity';
import { SalesReportController } from './sales-report.controller';
import { SalesReportService } from './sales-report.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceEntity])],
  controllers: [SalesReportController],
  providers: [SalesReportService],
})
export class SalesReportModule {}
