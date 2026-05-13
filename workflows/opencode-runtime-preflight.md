# opencode-runtime-preflight workflow

## Purpose

Before selecting opencode for test-repair tasks, run a runtime health
and auth preflight. Exclude opencode from dispatch when unhealthy.
Addresses environment pressure 12 with 0% success rate observed over
3 runs.

## When to trigger

- Task dispatch is choosing opencode for test-repair tasks
- `gad` CLI is about to spawn opencode
- Any automation that invokes `opencode` without health check

## Steps

### 1. Check opencode installation

```bash
which opencode || command -v opencode || echo "NOT_INSTALLED"
```

If not installed, skip to step4 (exclude).

### 2. Run health preflight

```bash
gad runtime check opencode --json
```

Expected healthy output:
```json
{"runtime": "opencode", "status": "ok", "auth": "valid"}
```

### 3. Test with smoke prompt

```bash
echo "respond with: OK" | opencode --headless --quiet 2>&1 | grep -i "OK"
```

Set 30s timeout. If smoke fails, runtime is broken.

### 4. Exclude when unhealthy

When any check fails:

```bash
gad runtime exclude opencode --reason "health-preflight-failed" --task-types test-repair
gad state log "opencode-runtime-preflight: preflight failed, excluded from dispatch"
```

### 5. Continue with fallback

Dispatch to fallback runtime (claude-code, gemini-cli, or codex-cli).

## Failure modes

- **opencode hangs on preflight:** Set 30s timeout.
- **Installed but API key revoked:** Smoke prompt catches this.
- **Environment variables missing:** Check `gad env list` for required keys.

## References

- Candidate: `.planning/candidates/environment-bootstrap-skill-opencode-test-repair-environment-pressure/CANDIDATE.md`
- Related: `claude-code-runtime-preflight`, `gemini-cli-runtime-preflight`
- Decision gad-XXX: runtime preflight before dispatch
