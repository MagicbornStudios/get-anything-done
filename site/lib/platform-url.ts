/**
 * Returns an absolute URL pointing at the platform app.
 *
 * Configure via NEXT_PUBLIC_PLATFORM_URL. Defaults to http://localhost:3002
 * for local development. Override in production builds by setting the env var
 * in Vercel project settings (or your CI provider).
 */
export function platformUrl(path: string = ''): string {
  const base = process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3002';
  const cleaned = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleaned}`;
}
