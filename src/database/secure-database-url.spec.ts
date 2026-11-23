import { secureDatabaseUrl } from './secure-database-url';

describe('secureDatabaseUrl', () => {
  it('upgrades a Neon URL from sslmode=require to verify-full', () => {
    const value = secureDatabaseUrl(
      'postgresql://user:pass@host.neon.tech/db?sslmode=require',
    );
    expect(new URL(value).searchParams.get('sslmode')).toBe('verify-full');
  });

  it('rejects a non-PostgreSQL URL', () => {
    expect(() => secureDatabaseUrl('https://example.com')).toThrow();
  });
});
