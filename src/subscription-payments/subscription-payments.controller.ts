import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { SkipBusinessContext } from 'src/common/decorators/skip-business-context.decorator';
import { InitiateSubscriptionPaymentDto } from './dto/subscription-payments.dto';
import { PaymentProvider } from './enums/payment-provider.enum';
import { SubscriptionPaymentsService } from './subscription-payments.service';
import { EsewaGateway } from './gateways/esewa.gateway';

@Controller('subscription-payments')
export class SubscriptionPaymentsController {
  constructor(
    private readonly payments: SubscriptionPaymentsService,
    private readonly esewa: EsewaGateway,
  ) {}

  // A scoped business token is not needed here: the service checks ownership in the DB.
  @SkipBusinessContext()
  @Post('checkout')
  checkout(
    @ActiveUser('sub') userId: string,
    @Body() dto: InitiateSubscriptionPaymentDto,
  ) {
    return this.payments.startCheckout(Number(userId), dto);
  }

  @SkipBusinessContext()
  @Get('status/:paymentId')
  status(
    @ActiveUser('sub') userId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.payments.getPaymentStatus(Number(userId), paymentId);
  }

  // The browser carries only a reference. The service calls eSewa to verify it.
  @Public()
  @SkipBusinessContext()
  @Get('return/esewa')
  esewaReturn(@Query('data') data: string) {
    if (!data) throw new BadRequestException('Missing eSewa response');
    const reference = this.esewa.verifiedReturnReference(data);
    return this.payments.confirmReference(PaymentProvider.ESEWA, reference);
  }

  @Public()
  @SkipBusinessContext()
  @Get('return/esewa/failure')
  esewaFailure() {
    return { status: 'PAYMENT_NOT_CONFIRMED' };
  }

  @Public()
  @SkipBusinessContext()
  @Get('return/khalti')
  khaltiReturn(@Query('pidx') pidx: string) {
    return this.payments.confirmReference(PaymentProvider.KHALTI, pidx);
  }
}
