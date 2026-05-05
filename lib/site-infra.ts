/**
 * @gad/site-infra — typed helpers for Vercel deployment config.
 *
 * Used by `sites/<slug>/vercel.ts` to compose programmable, typed
 * deployment config in place of hand-written vercel.json. Imports as
 * a relative path during phase 137; promotes to a published package
 * (`@gad/site-infra`) once a second site adopts.
 *
 * See `.planning/notes/2026-05-05-site-infra-as-code.md` for design.
 */

export interface VercelHeader {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

export interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
}

export interface VercelRewrite {
  source: string;
  destination: string;
}

export interface VercelCron {
  path: string;
  schedule: string; // cron expression
}

export interface VercelConfig {
  $schema?: string;
  framework?: string | null;
  buildCommand?: string | null;
  installCommand?: string | null;
  devCommand?: string | null;
  outputDirectory?: string | null;
  headers?: VercelHeader[];
  redirects?: VercelRedirect[];
  rewrites?: VercelRewrite[];
  crons?: VercelCron[];
  regions?: string[];
  cleanUrls?: boolean;
  trailingSlash?: boolean;
}

/**
 * Standard security headers — X-Content-Type-Options, Referrer-Policy,
 * X-Frame-Options. Drop-in for any public site that doesn't iframe.
 */
export function secureHeaders(source: string): VercelHeader {
  return {
    source,
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ],
  };
}

/**
 * Long-cache immutable asset header — for content-hashed or
 * never-changing static assets (photos, fonts, /_next/static/*).
 */
export function immutableAssetCache(source: string): VercelHeader {
  return {
    source,
    headers: [
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ],
  };
}

/**
 * `X-Robots-Tag: noindex` — for staging / preview surfaces that should
 * not appear in search results. Apply at root path `/(.*)`.
 */
export function noIndexRobots(source: string = '/(.*)'): VercelHeader {
  return {
    source,
    headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
  };
}

/** Daily cron — fires once at 00:00 UTC. */
export function dailyCron(path: string): VercelCron {
  return { path, schedule: '0 0 * * *' };
}

/** Hourly cron. */
export function hourlyCron(path: string): VercelCron {
  return { path, schedule: '0 * * * *' };
}

/**
 * Compose a full config from a partial — applies the GAD-default
 * `$schema` pointer so editors get validation in vercel.json fallback.
 */
export function defineConfig(partial: VercelConfig): VercelConfig {
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    ...partial,
  };
}
