import {
  Controller,
  Post,
  Body,
  UseGuards,
  Param,
  Headers,
  Req,
  Get,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/guards.module';
import { SubscriptionPaymentsService } from './subscription-payments.service';
import { InitiateSubscriptionPaymentDto } from './dto/subscription-payments.dto';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentStatus } from './interfaces/payment-response.dto';
import { Request } from 'express';

@Controller('subscription-payments')
export class SubscriptionPaymentsController {
  constructor(
    private readonly subscriptionPaymentsService: SubscriptionPaymentsService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async initiateCheckout(@Body() dto: InitiateSubscriptionPaymentDto) {
    const response = await this.subscriptionPaymentsService.initiatePayment({
      businessId: dto.businessId,
      planId: dto.planId,
      customerId: dto.customerId,
      paymentProvider: dto.paymentProvider,
      amount: dto.amount,
      currency: dto.currency,
      returnUrl: dto.returnUrl,
      cancelUrl: dto.cancelUrl,
      subscriptionId: dto.subscriptionId,
    });

    return {
      success: true,
      data: {
        transactionId: response.transactionId,
        status: response.status,
        nextAction: response.nextAction,
        redirectUrl: response.redirectUrl,
      },
    };
  }

  @Post('webhook/:provider')
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers('stripe-signature') stripeSignature: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() payload: unknown,
  ) {
    const paymentProvider = provider.toUpperCase() as PaymentProvider;

    const response = await this.subscriptionPaymentsService.handleWebhook(
      paymentProvider,
      payload,
      stripeSignature,
      req.rawBody as Buffer,
    );

    return { received: true, transactionId: response.transactionId };
  }
  @Get('verify/:provider/:transactionId')
  async verifyPayment(
    @Param('provider') provider: string,
    @Param('transactionId') transactionId: string,
  ) {
    const paymentProvider = provider.toUpperCase() as PaymentProvider;
    const response = await this.subscriptionPaymentsService.verifyPayment(
      paymentProvider,
      transactionId,
    );
    return { success: true, data: response };
  }
  // src/subscription-payments/subscription-payments.controller.ts

  @Get('success/:provider')
  async esewaSuccess(
    @Param('provider') provider: string,
    @Query() query: Record<string, string>,
  ) {
    // eSewa sends the response as a base64-encoded query param or body
    const paymentProvider = provider.toUpperCase() as PaymentProvider;
    const response = await this.subscriptionPaymentsService.handleWebhook(
      paymentProvider,
      query.data, // eSewa sends the base64 payload as 'data' param
    );

    if (response.status === PaymentStatus.SUCCEEDED) {
      return {
        success: true,
        message: 'Payment completed',
        transactionId: response.transactionId,
      };
    }
    return {
      success: false,
      message: 'Payment failed',
      transactionId: response.transactionId,
    };
  }

  @Get('failure/:provider')
  async esewaFailure(@Param('provider') provider: string) {
    return { success: false, message: 'Payment was cancelled or failed' };
  }

  // In subscription-payments.controller.ts

  @Get('success/khalti')
  async khaltiSuccess(@Query() query: Record<string, string>) {
    // Khalti sends pidx, status, amount, transaction_id, etc. as query params
    const response = await this.subscriptionPaymentsService.handleWebhook(
      PaymentProvider.KHALTI,
      query,
    );

    if (response.status === PaymentStatus.SUCCEEDED) {
      return {
        success: true,
        message: 'Payment completed',
        transactionId: response.transactionId,
      };
    }
    return {
      success: false,
      message: 'Payment failed',
      transactionId: response.transactionId,
    };
  }

  @Get('failure/khalti')
  async khaltiFailure(@Query() query: Record<string, string>) {
    return { success: false, message: 'Payment was cancelled or failed' };
  }
}
