import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Reject an unsafe live configuration before accepting checkout requests. */
@Injectable()
export class PaymentConfigurationValidator implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.validate();
  }

  validate() {
    if (this.config.get<string>('NODE_ENV') !== 'production') return;

    for (const key of [
      'ESEWA_SECRET_KEY',
      'ESEWA_PRODUCT_CODE',
      'KHALTI_SECRET_KEY',
    ]) {
      if (!this.config.get<string>(key)?.trim()) {
        throw new Error(`${key} is required for live payments`);
      }
    }

    for (const key of [
      'PAYMENT_CALLBACK_BASE_URL',
      'PAYMENT_WEBSITE_URL',
      'ESEWA_FORM_BASE_URL',
      'ESEWA_STATUS_BASE_URL',
      'KHALTI_BASE_URL',
    ]) {
      const value = this.config.get<string>(key);
      if (!value) throw new Error(`${key} is required for live payments`);
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new Error(`${key} must be a valid URL`);
      }
      if (
        url.protocol !== 'https:' ||
        url.hostname === 'localhost' ||
        url.hostname.startsWith('127.') ||
        (key === 'ESEWA_FORM_BASE_URL' &&
          url.hostname !== 'epay.esewa.com.np') ||
        (key === 'ESEWA_STATUS_BASE_URL' && url.hostname !== 'esewa.com.np') ||
        (key === 'KHALTI_BASE_URL' && url.hostname !== 'khalti.com')
      ) {
        throw new Error(`${key} must use a live HTTPS host`);
      }
    }
  }
}
