import { MigrationInterface, QueryRunner } from 'typeorm';

/** Preserve provider timing and coordinate frontend status lookups. */
export class PaymentLookupSafety1790000000001 implements MigrationInterface {
  name = 'PaymentLookupSafety1790000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payment_transactions
      ADD COLUMN IF NOT EXISTS lookup_started_at timestamp`);
    await queryRunner.query(`ALTER TABLE payment_transactions
      ADD COLUMN IF NOT EXISTS provider_observed_at timestamp`);
    await queryRunner.query(`ALTER TABLE payment_transactions
      ADD COLUMN IF NOT EXISTS provider_expires_at timestamp`);
    await queryRunner.query(`ALTER TABLE payment_transactions
      ADD COLUMN IF NOT EXISTS checkout_form_fields jsonb`);
    // The older implementation stored eSewa's reusable signed form here.
    await queryRunner.query(`UPDATE payment_transactions
      SET checkout_form_fields = gateway_payload
      WHERE provider = 'ESEWA' AND checkout_form_fields IS NULL
        AND gateway_payload ? 'signature'
        AND gateway_payload ? 'transaction_uuid'`);
  }

  public down(): Promise<void> {
    // These columns are operational history. Keep them on rollback.
    return Promise.reject(
      new Error('Payment lookup safety migration cannot be safely rolled back'),
    );
  }
}
