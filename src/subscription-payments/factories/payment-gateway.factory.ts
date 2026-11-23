// src/subscription-payments/factories/payment-gateway.factory.ts
import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { IPaymentGateway } from '../interfaces/ipayment-gateway.interface';
import { EsewaGateway } from '../gateways/esewa.gateway';
import { KhaltiGateway } from '../gateways/khalti.gateway';

@Injectable()
export class PaymentGatewayFactory {
  private readonly registry = new Map<PaymentProvider, IPaymentGateway>();

  constructor(esewa: EsewaGateway, khalti: KhaltiGateway) {
    this.registry.set(PaymentProvider.ESEWA, esewa);
    this.registry.set(PaymentProvider.KHALTI, khalti);
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
