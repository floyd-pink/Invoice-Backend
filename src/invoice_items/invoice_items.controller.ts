import { Body, Controller, Post } from '@nestjs/common';
import { CreateInvoiceDto } from '../invoice_items/dto/invoice_items.dto';
import { InvoiceItemsService } from './invoice_items.service';
@Controller('invoice-items')
export class InvoiceItemsController {
  constructor(private readonly invoiceItemsService: InvoiceItemsService) {}
  @Post('create-invoice')
  async createInvoice(@Body() payload: CreateInvoiceDto) {
    return this.invoiceItemsService.createInvoice(payload);
  }
}
