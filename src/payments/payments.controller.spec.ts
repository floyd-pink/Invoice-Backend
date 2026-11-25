import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ReceivePaymentDto } from './dto/receive-payment.dto';

describe('PaymentsController', () => {
  it('passes the selected business to invoice payment recording', async () => {
    const receivePayment = jest
      .fn()
      .mockResolvedValue({ paymentId: 'payment-1' });
    const controller = new PaymentsController({
      receivePayment,
    } as unknown as PaymentsService);
    const payload = { payment_amount: 100 } as ReceivePaymentDto;
    await controller.receivePayment('invoice-1', payload, 'business-1');
    expect(receivePayment).toHaveBeenCalledWith(
      payload,
      'invoice-1',
      'business-1',
    );
  });
});
