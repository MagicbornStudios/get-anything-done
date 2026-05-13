# Workflow: Premium API Opt-In Only

## Inputs
- Feature spec or PR that multiplies LLM API calls per user action
- Or: health probe implementation that calls any external endpoint

## Steps
1. **Identify the cost multiplier**: does this feature make more than 1 LLM call per user action? Fan-out to multiple providers? A/B comparison path? If yes, proceed.
2. **Gate the feature behind an env flag**: `FEATURE_<NAME>_ENABLED=true` (default absent = off). The feature must not activate if the flag is unset.
3. **Document the cost profile** in the feature's config comment: `// Doubles Anthropic spend per chat submit when enabled. Opt-in via FEATURE_KAEL_DUAL_GENERATE=true`.
4. **Health probes**: audit the probe endpoint list. Any probe that calls a paid API endpoint must be removed or replaced with a free/internal endpoint. Health probes MUST NOT silently fall back to paid endpoints.
5. **Code review checklist**: grep for `fetch`/`axios`/`streamText`/`generateText` calls not guarded by an opt-in flag; flag every hit.
6. **Test**: disable the flag, run the user action, confirm only baseline API calls fire (check spend ledger or mock interceptor count).

## Verification
```sh
# Confirm feature off by default
grep -r "FEATURE_" .env.example | grep "=true"  # should be empty or explicit opt-ins documented
# Confirm no paid-endpoint probe fallback in health check code
```

## Failure modes
- **Silent flag default**: feature checks `process.env.FLAG || 'true'` — default-on via string fallback. Always default to `false`/absent.
- **Health probe fallback**: `if (!freeEndpoint) callPaidEndpoint()` — never acceptable; fail the probe instead.
- **Partial gating**: flag gates the UI toggle but not the underlying API call path.
