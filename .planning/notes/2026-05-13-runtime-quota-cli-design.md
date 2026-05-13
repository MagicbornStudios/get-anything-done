# Runtime Quota CLI Design (gad quota)

**Outcome:** Add a `gad quota` subcommand to check per-runtime quota/usage without leaving terminal. One unified output table showing each runtime's current allocation and consumption.

**Date:** 2026-05-13  
**Agent:** Claude (Haiku 4.5)

---

## Per-Runtime Feasibility

### 1. Gemini (Google Generative AI)

**Endpoint:** Google Cloud Console quotas dashboard OR `/stats` command in gemini-cli.

**Feasibility:** MODERATE
- **Path A (preferred):** Read quota from **Google Cloud Console quota endpoint** via Service Account or OAuth user credentials.
  - Requires `projects.locations.quotas.list` IAM permission (Cloud Resource Manager API).
  - Can infer usage from billing data or daily quota consumption tracking.
  - Drawback: extra API call to GCP, quota data is project-level not per-key.
- **Path B (fallback):** Shell out to `gemini-cli /stats` if installed and authenticated locally.
  - Pros: zero extra auth, reads live session-scoped usage.
  - Cons: only works if gemini-cli is installed; doesn't expose billing tier limits directly.

**Recommended:** Path A (GCP API) for production; fallback to Path B for local dev.

**Env vars to read:** `GOOGLE_API_KEY` (already checked in runtime-health.cjs) or service account JSON path.

---

### 2. OpenRouter

**Endpoint:** `GET /api/v1/auth/key` (returns rate limits) + `GET /api/v1/credits` (returns remaining credits).

**Feasibility:** EASY
- Documented and stable.
- Single HTTP call with `Authorization: Bearer ${OPENROUTER_API_KEY}` header.
- Returns `data.rate_limit_remaining` and `data.rate_limit_requests_per_minute`.

**Env vars to read:** `OPENROUTER_API_KEY` (already checked in runtime-health.cjs).

**Example response shape:**
```json
{
  "data": {
    "rate_limit_remaining": 9950,
    "rate_limit_requests_per_minute": 10000,
    "daily_credits_remaining": 5.23,
    "monthly_spend_usd": 18.47
  }
}
```

---

### 3. Claude (Anthropic)

**Endpoint:** No direct quota endpoint. Usage inferred from billing tier + spend tracking.

**Feasibility:** MODERATE
- Anthropic API has no `/limits` or `/usage` endpoint per public docs (Feb 2025).
- Usage + rate limits are per **billing tier** (Tier 1-4, tied to account, not per-key).
- Rate-limit headers in API responses: `anthropic-ratelimit-requests-remaining`, `anthropic-ratelimit-tokens-remaining`.

**Recommended approach:**
- **Read from Claude Console** (requires OAuth + session): POST a fake request to get rate-limit headers, then surface them. Drawback: requires active session.
- **Fall back to environment + hardcoded tier:** Read `ANTHROPIC_API_KEY`, infer tier from account metadata (if available), and show tier + RPM/ITPM/OTPM limits from documentation.
- **Best UX:** If no quota endpoint exists, show tier name + documented limits instead of "live usage." Operator knows which tier they're on.

**Env vars to read:** `ANTHROPIC_API_KEY`.

---

### 4. OpenAI / Codex

**Endpoint:** `GET /v1/organization/usage/completions` (and similar per usage type).

**Feasibility:** EASY
- Documented and stable (Usage API).
- Single HTTP call with `Authorization: Bearer ${OPENAI_API_KEY}` header.
- Returns daily/hourly usage aggregations by model, user, or organization.
- Can also use `GET /api/codex/usage` (Codex-specific endpoint, undocumented but stable).

**Env vars to read:** `OPENAI_API_KEY`.

**Example response shape (org usage):**
```json
{
  "object": "list",
  "data": [
    {
      "snapshot_id": "2026-05-13",
      "model_id": "gpt-4",
      "n_generated_tokens": 15432,
      "n_context_tokens": 8234,
      "requests": 123
    }
  ]
}
```

---

## Proposed CLI Shape

**Recommended:** `gad quota [--runtime <name>] [--json] [--project <id>]`

Not `gad runtime quota` because:
- `runtime` already has 6 subcommands (check, select, matrix, pipeline, launch, budget).
- `gad quota` is cleaner, parallel to `gad budget` (which tracks token costs).
- Can be extended later to `gad quota limits`, `gad quota alerts` without crowding runtime-cmd.

### Shape Details

```bash
gad quota                           # all runtimes
gad quota --runtime gemini          # gemini only
gad quota --runtime openrouter      # openrouter only
gad quota --runtime anthropic       # anthropic only
gad quota --runtime openai          # openai only
gad quota --json                    # JSON output for scripting
gad quota --since 2026-05-12        # usage since date (for openai only)
```

---

## User-Facing Output

**Default (human-readable table):**

```
gad quota

Runtime         Remaining               Limit/Tier              Usage Today     Status
──────────────────────────────────────────────────────────────────────────────────────
gemini          18,234 credits          100,000 /day (free)     81,766          ✓ OK
openrouter      $145.67 / day           $1,000 /month           $18.32          ✓ OK
anthropic       Tier 3 (unlimited RPM)  5,000 ITPM / 15k OTPM   $23.45 /month   ✓ OK
openai          2,345 requests          10,000 /min             742 /min        ⚠ 25% used
```

**JSON output (for scripting):**

```json
{
  "timestamp": "2026-05-13T14:32:00Z",
  "quotas": [
    {
      "runtime": "gemini",
      "quota_type": "daily_credits",
      "limit": 100000,
      "remaining": 18234,
      "usage_percent": 81.77,
      "period": "24h",
      "status": "ok"
    },
    {
      "runtime": "openrouter",
      "quota_type": "monthly_credits",
      "limit": 1000,
      "remaining": 981.68,
      "usage_usd": 18.32,
      "status": "ok"
    },
    {
      "runtime": "anthropic",
      "quota_type": "rate_limits",
      "tier": "3",
      "limits": {
        "itpm": 5000,
        "otpm": 15000,
        "rpm": "unlimited"
      },
      "current_usage": {
        "itpm": 1200,
        "otpm": 3400
      },
      "status": "ok"
    }
  ]
}
```

---

## API Key / Auth Strategy

**Key discovery order per runtime:**

1. **Gemini:** `GOOGLE_API_KEY` env var → fallback to `~/.gad-credentials/google-api-key.json` (service account).
2. **OpenRouter:** `OPENROUTER_API_KEY` env var → fallback to gad account config.
3. **Anthropic:** `ANTHROPIC_API_KEY` env var → fallback to gad account config.
4. **OpenAI:** `OPENAI_API_KEY` env var → fallback to gad account config.

**No prompting for credentials:** If a key is missing, output a clear message pointing to setup docs, but don't prompt interactively. Parallel with existing `gad runtime health` behavior.

---

## Implementation Notes

### New files:
- `lib/runtime-quota/index.cjs` — main quota-fetch logic per runtime.
- `lib/runtime-quota/gemini.cjs` — Google Cloud API client.
- `lib/runtime-quota/openrouter.cjs` — OpenRouter API client.
- `lib/runtime-quota/anthropic.cjs` — Anthropic tier lookup (static tier data + inference).
- `lib/runtime-quota/openai.cjs` — OpenAI usage API client.
- `lib/runtime-quota/formatters.cjs` — table + JSON renderers.

### Wiring:
- `bin/commands/quota.cjs` — entry point, dispatches per-runtime, calls formatters.
- Register in `bin/gad.cjs` dispatcher alongside other top-level commands.

### Error handling:
- Network failures: print "unable to fetch" + reason, exit 1, suggest retry.
- Missing keys: print "OPENROUTER_API_KEY not set" + link to docs, exit 0 (not fatal).
- Rate-limited on quota fetch itself: backoff + retry up to 2x.

---

## Suggested Phase

**Phase 75 (Runtime Launch Hardening)** or new **Phase 110 (Multi-Account Credential Manager).**

- **Phase 75** if treated as a "hardening" feature: visibility into quota before/after heavy runs.
- **Phase 110** if part of broader credential + account management overhaul (mentioned in memory as planned for OAuth multi-account scoping).

**Recommendation:** Phase 75, pair with `gad runtime health` enhancements (currently reports "key set?" → expand to actual quota check).

---

## Task Specification

**Title:** Add `gad quota` subcommand for per-runtime quota usage reporting.

**Goal:** Implement `gad quota [--runtime <name>] [--json]` to check API quota/usage across Gemini, OpenRouter, Anthropic, OpenAI without leaving the terminal. Show remaining quota, limit, usage percent, and status in a single unified table.

**Why:** Operator currently has to open four separate dashboards (Google Cloud, OpenRouter web, Anthropic Console, OpenAI dashboard) to answer "what's my quota status?" This makes it scriptable and terminal-native, matching `gad runtime health` pattern.

**References:**
- OpenRouter docs: `/api/v1/auth/key` + `/api/v1/credits`
- OpenAI docs: `/v1/organization/usage/*` endpoints
- Google Cloud: quotas.list API (Service Account or OAuth)
- Anthropic: rate-limit headers on API response (no live quota endpoint; show tier instead)

**Files to create:**
- `lib/runtime-quota/index.cjs`
- `lib/runtime-quota/gemini.cjs`
- `lib/runtime-quota/openrouter.cjs`
- `lib/runtime-quota/anthropic.cjs`
- `lib/runtime-quota/openai.cjs`
- `lib/runtime-quota/formatters.cjs`
- `bin/commands/quota.cjs`

**Files to modify:**
- `bin/gad.cjs` (register quota command in dispatcher)

**Tests:** Unit tests for each runtime's response parsing; integration test for all runtimes when keys are available.

---

## Open Questions

1. **Anthropic tier inference:** Should we hardcode Anthropic's 4 tiers + their limits into the codebase, or fetch from Anthropic's public pricing page? (Hardcoding is simpler; public page fetch is future-proof.)

2. **Gemini quotas via GCP:** Does the operator have a Service Account or OAuth flow set up? If not, can we surface quota from `gemini-cli` locally instead? (Decision: try GCP API first; fallback to gemini-cli.)

3. **Daily vs monthly aggregation:** Gemini + OpenRouter track daily/monthly differently. Should `gad quota` always show the most restrictive (monthly)? Or per-runtime? (Recommendation: show both, operator can glance at risk.)

4. **Billing email sync:** Should we offer future feature to sync quota checks with last known API bill (from email scraping)? (Out of scope for MVP; future Phase 110+ feature.)

---

**Status:** DESIGN ONLY — no implementation. Ready for operator review before task registration.
