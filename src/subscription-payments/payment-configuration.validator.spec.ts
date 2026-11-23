import { PaymentConfigurationValidator } from './payment-configuration.validator';

describe('PaymentConfigurationValidator', () => {
  const values = {
    NODE_ENV: 'production',
    ESEWA_SECRET_KEY: 'merchant-secret',
    ESEWA_PRODUCT_CODE: 'MERCHANT',
    KHALTI_SECRET_KEY: 'merchant-secret',
    PAYMENT_CALLBACK_BASE_URL: 'https://api.example.com',
    PAYMENT_WEBSITE_URL: 'https://app.example.com',
    ESEWA_FORM_BASE_URL: 'https://epay.esewa.com.np',
    ESEWA_STATUS_BASE_URL: 'https://esewa.com.np',
    KHALTI_BASE_URL: 'https://khalti.com/api/v2',
  };

  it('rejects a sandbox gateway URL in production', () => {
    const config = {
      get: (key: string) =>
        ({ ...values, KHALTI_BASE_URL: 'https://dev.khalti.com/api/v2' })[key],
    };
    expect(() =>
      new PaymentConfigurationValidator(config as never).onModuleInit(),
    ).toThrow('KHALTI_BASE_URL must use a live HTTPS host');
  });

  it('accepts complete live configuration', () => {
    const config = { get: (key: string) => values[key] };
    expect(() =>
      new PaymentConfigurationValidator(config as never).onModuleInit(),
    ).not.toThrow();
  });
});
