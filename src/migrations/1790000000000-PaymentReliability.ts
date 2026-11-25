import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds payment recovery fields while preserving existing payment rows. */
export class PaymentReliability1790000000000 implements MigrationInterface {
  name = 'PaymentReliability1790000000000';
  // PostgreSQL enum additions must commit before the new values are used.
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE payment_transactions_provider_enum AS ENUM ('ESEWA', 'KHALTI');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE payment_transactions_status_enum AS ENUM
        ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'ERROR');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    for (const status of ['INITIATING', 'PARTIALLY_REFUNDED', 'NEEDS_REVIEW']) {
      await queryRunner.query(
        `ALTER TYPE payment_transactions_status_enum ADD VALUE IF NOT EXISTS '${status}'`,
      );
    }
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider payment_transactions_provider_enum NOT NULL,
        provider_transaction_id varchar(255),
        status payment_transactions_status_enum NOT NULL DEFAULT 'PENDING',
        amount numeric(12,2) NOT NULL,
        currency varchar(3) NOT NULL,
        business_id uuid NOT NULL,
        subscription_id integer,
        plan_id integer NOT NULL,
        billing_cycle varchar(20),
        owner_id integer,
        request_id uuid,
        checkout_url text,
        gateway_payload jsonb,
        error_message text,
        retry_count integer NOT NULL DEFAULT 0,
        next_check_at timestamp,
        last_checked_at timestamp,
        check_attempts integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        completed_at timestamp,
        grant_starts_at timestamp,
        grant_ends_at timestamp
      )
    `);
    for (const sql of [
      'ADD COLUMN IF NOT EXISTS billing_cycle varchar(20)',
      'ADD COLUMN IF NOT EXISTS owner_id integer',
      'ADD COLUMN IF NOT EXISTS request_id uuid',
      'ADD COLUMN IF NOT EXISTS checkout_url text',
      'ADD COLUMN IF NOT EXISTS next_check_at timestamp',
      'ADD COLUMN IF NOT EXISTS last_checked_at timestamp',
      'ADD COLUMN IF NOT EXISTS check_attempts integer NOT NULL DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS grant_starts_at timestamp',
      'ADD COLUMN IF NOT EXISTS grant_ends_at timestamp',
    ]) {
      await queryRunner.query(`ALTER TABLE payment_transactions ${sql}`);
    }
    await queryRunner.query(`ALTER TABLE payment_transactions
      ALTER COLUMN provider_transaction_id DROP NOT NULL`);
    // Older payment code required these fields, but new checkout does not use them.
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_transactions' AND column_name = 'customer_id') THEN
        ALTER TABLE payment_transactions ALTER COLUMN customer_id DROP NOT NULL;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_transactions' AND column_name = 'idempotency_key') THEN
        ALTER TABLE payment_transactions ALTER COLUMN idempotency_key DROP NOT NULL;
      END IF;
    END $$`);
    await queryRunner.query(`ALTER TABLE users
      ADD COLUMN IF NOT EXISTS free_business_created boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE business
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE business
      ADD COLUMN IF NOT EXISTS requires_paid_subscription boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`UPDATE users SET free_business_created = true
      WHERE EXISTS (SELECT 1 FROM business WHERE business.business_owner_id = users.id)`);
    await queryRunner.query(`UPDATE payment_transactions SET next_check_at = NOW()
      WHERE next_check_at IS NULL AND provider_transaction_id IS NOT NULL
        AND status IN ('PENDING', 'PROCESSING', 'SUCCEEDED')`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_PAYMENT_PROVIDER_REFERENCE"
      ON payment_transactions(provider, provider_transaction_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_PAYMENT_OWNER_REQUEST"
      ON payment_transactions(owner_id, request_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_PAYMENT_OPEN_BUSINESS"
      ON payment_transactions(business_id)
      WHERE status IN ('INITIATING', 'PENDING', 'PROCESSING', 'NEEDS_REVIEW')`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ACTIVE_BUSINESS_SUBSCRIPTION"
      ON business_subscription(business_id) WHERE status = 'ACTIVE'`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_NEXT_CHECK"
      ON payment_transactions(next_check_at) WHERE next_check_at IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_TRANS_PROVIDER_STATUS"
      ON payment_transactions(provider, status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_TRANS_BUSINESS"
      ON payment_transactions(business_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_TRANS_SUBSCRIPTION"
      ON payment_transactions(subscription_id)`);
  }

  public down(): Promise<void> {
    // Payment and entitlement history must never be deleted by a rollback.
    return Promise.reject(
      new Error('Payment reliability migration cannot be safely rolled back'),
    );
  }
}
