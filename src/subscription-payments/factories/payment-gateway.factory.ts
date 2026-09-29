// src/subscription-payments/factories/payment-gateway.factory.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { IPaymentGateway } from '../interfaces/ipayment-gateway.interface';
import { StripeGateway } from '../gateways/stripe.gateway';
import { EsewaGateway } from '../gateways/esewa.gateway';
import { KhaltiGateway } from '../gateways/khalti.gateway';

@Injectable()
export class PaymentGatewayFactory {
  private readonly registry = new Map<PaymentProvider, IPaymentGateway>();

  constructor(private readonly configService: ConfigService) {
    this.registry.set(
      PaymentProvider.STRIPE,
      new StripeGateway(this.configService),
    );
    this.registry.set(PaymentProvider.ESEWA, new EsewaGateway());
    this.registry.set(PaymentProvider.KHALTI, new KhaltiGateway());
  }

  resolve(provider: PaymentProvider): IPaymentGateway {
    const gateway = this.registry.get(provider);
    if (!gateway) {
      throw new Error(
        `No payment gateway registered for provider: ${provider}. ` +
          `Add an entry to PaymentGatewayFactory constructor.`,
      );
    }
    return gateway;
  }

  listRegisteredProviders(): PaymentProvider[] {
    return Array.from(this.registry.keys());
  }
}
