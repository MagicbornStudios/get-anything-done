'use strict';
/**
 * Shared Supabase client for the gad CLI.
 *
 * Reads env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (preferred) or
 * SUPABASE_ANON_KEY. Also loads a .env file from the gad project planning
 * root (repo root) using the same minimal dotenv parser that gad.cjs uses.
 *
 * Exports:
 *   getSupabaseClient() — memoized, returns { client, hasServiceRole: boolean }
 *   clearSupabaseClient() — test helper: resets the memoized instance
 *
 * Throws if env not set:
 *   "Supabase env not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *    (or SUPABASE_ANON_KEY) in your shell or .env."
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Find repo root (same logic as gad.cjs findRepoRoot)
// ---------------------------------------------------------------------------
function findRepoRoot(start) {
  let dir = start || process.cwd();
  const max = 20;
  for (let i = 0; i < max; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

// ---------------------------------------------------------------------------
// Load .env from repo root if it exists (same minimal parser as gad.cjs)
// ---------------------------------------------------------------------------
function loadEnvFile() {
  try {
    const envPath = path.join(findRepoRoot(), '.env');
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          // Don't overwrite values already set in the shell environment.
          if (!process.env[key]) {
            process.env[key] = match[2].trim();
          }
        }
      }
    }
  } catch (_) {
    // Non-fatal — shell env may be sufficient.
  }
}

// ---------------------------------------------------------------------------
// Memoized client instance
// ---------------------------------------------------------------------------
let _memoized = null;

/**
 * Returns a memoized Supabase client.
 *
 * @returns {{ client: import('@supabase/supabase-js').SupabaseClient, hasServiceRole: boolean }}
 */
function getSupabaseClient() {
  if (_memoized) return _memoized;

  // Load .env so callers don't need to pre-populate process.env manually.
  loadEnvFile();

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || (!serviceKey && !anonKey)) {
    throw new Error(
      'Supabase env not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ' +
      '(or SUPABASE_ANON_KEY) in your shell or .env.'
    );
  }

  const key = serviceKey || anonKey;
  const hasServiceRole = Boolean(serviceKey);

  // Dynamic require for CommonJS interop with @supabase/supabase-js ESM/CJS bundle.
  // eslint-disable-next-line
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(url, key, {
    auth: {
      // CLI-side: no browser session persistence needed.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  _memoized = { client, hasServiceRole };
  return _memoized;
}

/**
 * Reset the memoized client. Use in tests to inject a fresh env each run.
 */
function clearSupabaseClient() {
  _memoized = null;
}

module.exports = { getSupabaseClient, clearSupabaseClient };
