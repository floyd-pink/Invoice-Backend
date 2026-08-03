import { Injectable } from '@nestjs/common';
import { InvoiceEntity, InvoiceStatus } from '../entities/invoice.entity';
@Injectable()
export class InvoiceCalculationService {
  updateInvoiceStatus(invoice: InvoiceEntity) {
    invoice.dueAmount = invoice.totalAmount - invoice.paidAmount;

    if (invoice.paidAmount === 0) {
      invoice.status = InvoiceStatus.UNPAID;
    } else if (invoice.dueAmount === 0) {
      invoice.status = InvoiceStatus.PAID;
    } else {
      invoice.status = InvoiceStatus.PARTIALLY_PAID;
    }
  }
}
