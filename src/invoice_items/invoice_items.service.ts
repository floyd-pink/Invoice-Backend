import { Injectable } from '@nestjs/common';
import { CreateInvoiceDto } from '../invoice_items/dto/invoice_items.dto';
@Injectable()
export class InvoiceItemsService {
  private invoicesTable = [];
  private invoiceItemsTable = [];

  private nextInvoiceId = 1;
  private nextInvoiceItemId = 1;

  constructor() {}
  async createInvoice(payload: CreateInvoiceDto) {
    const calculatedTotal = payload.items.reduce(
      (sum, item) => sum + item.item_price * item.item_quantity,
      0,
    );
    return { message: 'Invoice created successfully', data: payload };
  }
}
