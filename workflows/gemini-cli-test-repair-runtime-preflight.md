# gemini-cli-test-repair-runtime-preflight workflow

## Purpose

Before selecting gemini-cli for test-repair tasks, run a runtime health
and auth preflight. Exclude gemini-cli from dispatch when unhealthy.
Addresses environment pressure 15 with 0% success rate observed over
3 runs.

## When to trigger

- Task dispatch is choosing gemini-cli for test-repair tasks
- `gad` CLI is about to spawn gemini-cli for test-repair
- Any automation that invokes `gemini-cli` without health check

## Steps

### 1. Check gemini-cli installation

```bash
which gemini-cli || command -v gemini-cli || echo "NOT_INSTALLED"
```

If not installed, skip to step4 (exclude).

### 2. Check auth mode

```bash
gad runtime check gemini-cli --auth-only --json
```

For headless contexts, also verify no interactive auth will be triggered:
```bash
ls ~/.gemini/credentials.json 2>/dev/null || echo "NO_CREDENTIALS"
```

### 3. Run smoke prompt

```bash
echo "respond with: OK" | gemini-cli --headless --quiet 2>&1 | grep -i "OK"
```

Set 30s timeout. If smoke fails, auth is broken.

### 4. Exclude when unhealthy

When any check fails:

```bash
gad runtime exclude gemini-cli --reason "health-preflight-failed" --task-types test-repair
gad state log "gemini-cli-test-repair-preflight: preflight failed, excluded from dispatch"
```

### 5. Continue with fallback

Dispatch to fallback runtime (claude-code, codex-cli, or opencode).

## Failure modes

- **gemini-cli hangs on preflight:** Set 30s timeout.
- **Credentials exist but API key revoked:** Smoke prompt catches this.
- **Interactive auth requested in headless:** Route to fallback immediately.

## References

- Candidate: `.planning/candidates/environment-bootstrap-skill-gemini-cli-test-repair-environment-pressure/CANDIDATE.md`
- Related: `gemini-cli-runtime-preflight`
- Decision gad-XXX: runtime preflight before dispatch
