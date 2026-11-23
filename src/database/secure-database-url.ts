/** Require both encryption and server identity verification for PostgreSQL. */
export function secureDatabaseUrl(value: string | undefined): string {
  if (!value) throw new Error('DATABASE_URL is required');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL is invalid');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL');
  }
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}
