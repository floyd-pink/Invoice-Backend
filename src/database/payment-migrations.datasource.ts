import { DataSource } from 'typeorm';
import { PaymentReliability1790000000000 } from '../migrations/1790000000000-PaymentReliability';
import { secureDatabaseUrl } from './secure-database-url';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run migrations');
}

export default new DataSource({
  type: 'postgres',
  url: secureDatabaseUrl(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: true },
  synchronize: false,
  migrations: [PaymentReliability1790000000000],
  migrationsTransactionMode: 'each',
});
