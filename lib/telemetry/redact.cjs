'use strict';
/**
 * Phase 145.5-06 — secret-redaction pass for telemetry / log streams.
 *
 * Operator standing rule 2026-05-07: "sensitive stuff should
 * automatically be caught by our daemons and file-watching." This
 * module is the central regex-pattern set + redact() function that
 * downstream surfaces use:
 *
 *   - lib/telemetry/export.cjs    — `--redact-secrets` flag (default ON)
 *   - bin/gad-stop-hook.cjs       — Claude assistant text capture
 *   - bin/gad-trace-hook.cjs      — PreToolUse / PostToolUse capture
 *   - file-watcher daemon          — scans .planning/.gad-log/* live
 *   - pre-commit hook              — staged-file scan
 *
 * Patterns favor false-positives (over-redact) over leaks. Adding a
 * new pattern: append to PATTERNS, write a kind label, write a test
 * fixture in tests/telemetry-redact.test.cjs.
 *
 * Output shape: `{ text: <redacted>, found: [{kind, count}, ...] }`.
 * Caller can attach `found` to manifest/envelope as audit trail.
 */

// Pattern table. Order matters — JWTs match before generic alphanum
// strings, otherwise we'd over-replace.
const PATTERNS = [
  // Clerk
  { kind: 'clerk_pk_test',      re: /\bpk_test_[A-Za-z0-9_\-]{20,}\b/g,           replace: '[REDACTED:clerk_pk_test]' },
  { kind: 'clerk_pk_live',      re: /\bpk_live_[A-Za-z0-9_\-]{20,}\b/g,           replace: '[REDACTED:clerk_pk_live]' },
  { kind: 'clerk_sk_test',      re: /\bsk_test_[A-Za-z0-9_\-]{20,}\b/g,           replace: '[REDACTED:clerk_sk_test]' },
  { kind: 'clerk_sk_live',      re: /\bsk_live_[A-Za-z0-9_\-]{20,}\b/g,           replace: '[REDACTED:clerk_sk_live]' },
  // Stripe
  { kind: 'stripe_secret',      re: /\brk_(test|live)_[A-Za-z0-9_]{20,}\b/g,      replace: '[REDACTED:stripe_restricted]' },
  { kind: 'stripe_webhook',     re: /\bwhsec_[A-Za-z0-9]{20,}\b/g,                replace: '[REDACTED:stripe_webhook]' },
  { kind: 'stripe_price',       re: /\bprice_[A-Za-z0-9]{20,}\b/g,                replace: '[REDACTED:stripe_price]' },
  // GitHub
  { kind: 'github_pat',         re: /\bghp_[A-Za-z0-9]{30,}\b/g,                  replace: '[REDACTED:github_pat]' },
  { kind: 'github_oauth',       re: /\bgho_[A-Za-z0-9]{30,}\b/g,                  replace: '[REDACTED:github_oauth]' },
  { kind: 'github_app',         re: /\bghs_[A-Za-z0-9]{30,}\b/g,                  replace: '[REDACTED:github_app]' },
  { kind: 'github_user_token',  re: /\bghu_[A-Za-z0-9]{30,}\b/g,                  replace: '[REDACTED:github_user_token]' },
  { kind: 'github_refresh',     re: /\bghr_[A-Za-z0-9]{30,}\b/g,                  replace: '[REDACTED:github_refresh]' },
  // Anthropic (must come BEFORE OpenAI; sk-ant-... would otherwise match
  // the more permissive openai pattern first)
  { kind: 'anthropic_api_key',  re: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/g,            replace: '[REDACTED:anthropic_api_key]' },
  // OpenAI
  { kind: 'openai_api_key',     re: /\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}\b/g,      replace: '[REDACTED:openai_api_key]' },
  // Slack
  { kind: 'slack_token',        re: /\bxox[bopas]-[A-Za-z0-9_\-]{20,}\b/g,        replace: '[REDACTED:slack_token]' },
  // Supabase
  { kind: 'supabase_pat',       re: /\bsbp_[A-Za-z0-9]{20,}\b/g,                  replace: '[REDACTED:supabase_pat]' },
  // Vercel
  { kind: 'vercel_token',       re: /\b[A-Za-z0-9]{24}\b(?=\s*(?:vercel|VERCEL))/g, replace: '[REDACTED:vercel_token]' },
  // Generic JWT (must come AFTER Clerk/Stripe specific to not double-match)
  { kind: 'jwt',                re: /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g, replace: '[REDACTED:jwt]' },
  // Generic Bearer header
  { kind: 'bearer_header',      re: /\bBearer\s+[A-Za-z0-9_.\-+/=]{20,}\b/g,      replace: 'Bearer [REDACTED:bearer]' },
  // KEY=value patterns where KEY contains SECRET / TOKEN / PASSWORD
  // (catches custom env-var-style leaks even if the value isn't a known shape)
  { kind: 'env_var_assignment',
    re: /\b((?:[A-Z][A-Z0-9_]*)?(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_KEY|SERVICE_ROLE)[A-Z0-9_]*)\s*=\s*['"]?([^\s'"&]{8,})['"]?/g,
    replace: '$1=[REDACTED:env_var]' },
  // PEM private key blocks
  { kind: 'pem_private_key',    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replace: '[REDACTED:pem_private_key]' },
  // AWS access keys
  { kind: 'aws_access_key',     re: /\bAKIA[0-9A-Z]{16}\b/g,                      replace: '[REDACTED:aws_access_key]' },
  { kind: 'aws_secret',         re: /\b[0-9A-Za-z/+=]{40}\b(?=\s*(?:aws|AWS))/g,   replace: '[REDACTED:aws_secret]' },
];

/**
 * Redact a text blob in place. Returns:
 *   { text: <redacted-string>, found: [{kind, count}, ...], anyFound: <bool> }
 *
 * Callers should:
 *   - For envelope.content.text fields → just replace `text` with output.text
 *   - For manifest stamping → record output.found as `redacted_kinds` array
 *   - For audit logs → log `anyFound` (don't log the matched value)
 */
function redactSecrets(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { text: text || '', found: [], anyFound: false };
  }
  let working = text;
  const found = [];
  for (const { kind, re, replace } of PATTERNS) {
    re.lastIndex = 0;
    const matches = working.match(re);
    if (matches && matches.length > 0) {
      working = working.replace(re, replace);
      found.push({ kind, count: matches.length });
    }
  }
  return { text: working, found, anyFound: found.length > 0 };
}

/**
 * Recursively redact a value (string | object | array). Used by
 * adapter wiring so a whole envelope's `content` can be passed
 * through.
 */
function redactDeep(value) {
  if (typeof value === 'string') {
    return redactSecrets(value).text;
  }
  if (Array.isArray(value)) {
    return value.map(redactDeep);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * Convenience: redact an envelope's content + tag it as redacted.
 * Returns a new envelope (or same envelope if no redactions found).
 */
function redactEnvelope(env) {
  if (!env || typeof env !== 'object') return env;
  const before = JSON.stringify(env.content || '');
  const cleaned = redactDeep(env.content);
  const after = JSON.stringify(cleaned);
  if (before === after) return env;
  // Don't mutate frozen envelopes — return a copy.
  return Object.freeze({ ...env, content: cleaned, redacted: true });
}

/**
 * Quick check — true iff any secret pattern is in the text. Used by
 * pre-commit hook to fail-loud without doing the full replace.
 */
function containsSecret(text) {
  if (typeof text !== 'string' || text.length === 0) return false;
  for (const { re } of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) return true;
  }
  return false;
}

module.exports = {
  PATTERNS,
  redactSecrets,
  redactDeep,
  redactEnvelope,
  containsSecret,
};
