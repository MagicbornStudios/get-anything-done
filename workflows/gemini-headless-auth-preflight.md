# gemini-headless-auth-preflight workflow

## Purpose

Prevent gemini-cli from being selected for headless planning tasks when auth is not properly configured. Gemini headless auth fails silently (0% success rate observed over 6 runs), so a preflight check is mandatory before dispatch.

## When to trigger

- User requests planning in a headless/automated context
- Task dispatch is choosing between multiple runtimes
- `gad` CLI is about to spawn gemini-cli for a planning task
- Any automation that invokes `gemini-cli` without interactive auth flow

## Steps

### 1. Detect auth mode

Check how gemini-cli is configured:

```bash
# Check if gemini-cli has valid credentials cached
gad runtime check gemini-cli --auth-only
# Or check the credential file directly
ls ~/.gemini/credentials.json 2>/dev/null || echo "NO_CREDENTIALS"
```

If the command fails or returns NO_CREDENTIALS, gemini-cli is not auth-ready for headless use.

### 2. Run smoke prompt

If credentials exist, run a minimal smoke test to verify auth works end-to-end:

```bash
echo "respond with: OK" | gemini-cli --headless --quiet 2>&1 | grep -i "OK"
```

If the smoke prompt does not return success within 30 seconds, auth is broken despite credentials existing.

### 3. Route to fallback

When auth preflight fails (step 1 or 2), route to fallback runtime:

| Original target | Fallback preference |
|-----------------|---------------------|
| gemini-cli (planning) | claude-code or opencode |
| gemini-cli (test-repair) | codex-cli or opencode |
| gemini-cli (any headless) | any runtime with passing preflight |

Log the routing decision:

```bash
gad state log "gemini-headless-auth-preflight: auth preflight failed, routed to <fallback> instead of gemini-cli"
```

### 4. Mark runtime blocked (optional, for matrix scoring)

If this is part of a benchmark/eval matrix, exclude gemini-cli from scoring for this round:

```bash
gad runtime matrix exclude gemini-cli --reason "auth-preflight-failed"
```

## Failure modes

- **Smoke prompt hangs:** Set 30s timeout. If smoke hangs, treat as auth failure.
- **Credentials exist but API key revoked:** Smoke prompt catches this case; credentials check alone is insufficient.
- **Interactive auth requested:** Headless mode should never trigger interactive auth. If it does, auth mode detection missed something — route to fallback immediately.

## References

- Candidate: `.planning/candidates/gemini-headless-auth-preflight/CANDIDATE.md`
- Related: `exclude-unhealthy-runtime-from-matrix`
- Decision gad-XXX: runtime preflight before dispatch
