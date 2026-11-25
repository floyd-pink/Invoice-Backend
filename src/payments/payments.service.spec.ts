import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InvoiceStatus } from 'src/invoice_items/entities/invoice.entity';
import { ReceivePaymentDto } from './dto/receive-payment.dto';

describe('PaymentsService', () => {
  const invoices = { findOne: jest.fn() };
  const dataSource = { createQueryRunner: jest.fn() };
  const service = new PaymentsService(
    invoices as never,
    dataSource as never,
    {} as never,
  );
  const payload = { payment_amount: 100 } as ReceivePaymentDto;

  beforeEach(() => jest.clearAllMocks());

  it('does not record a payment for an invoice outside the selected business', async () => {
    invoices.findOne.mockResolvedValue(null);
    await expect(
      service.receivePayment(payload, 'invoice-1', 'business-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(invoices.findOne).toHaveBeenCalledWith({
      where: {
        id: 'invoice-1',
        business: { business_id: 'business-1' },
      },
    });
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('rejects payments for a cancelled invoice before opening a database transaction', async () => {
    invoices.findOne.mockResolvedValue({ status: InvoiceStatus.CANCELLED });
    await expect(
      service.receivePayment(payload, 'invoice-1', 'business-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });
});
