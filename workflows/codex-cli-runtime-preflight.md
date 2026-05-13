# codex-cli-runtime-preflight workflow

## Purpose

Before selecting codex-cli for test-repair tasks, run a runtime health
and auth preflight. Exclude codex-cli from dispatch when unhealthy.
Addresses environment pressure 15 with 0% success rate and 3
auth_failures observed over 3 runs.

## When to trigger

- Task dispatch is choosing codex-cli for test-repair tasks
- `gad` CLI is about to spawn codex-cli
- Any automation that invokes `codex-cli` without health check

## Steps

### 1. Check codex-cli installation

```bash
which codex-cli || command -v codex-cli || echo "NOT_INSTALLED"
```

If not installed, skip to step4 (exclude).

### 2. Run health preflight

```bash
gad runtime check codex-cli --json
```

Expected healthy output:
```json
{"runtime": "codex-cli", "status": "ok", "auth": "valid"}
```

### 3. Test auth with smoke prompt

```bash
echo "respond with: OK" | codex-cli --headless --quiet 2>&1 | grep -i "OK"
```

Set 30s timeout. If smoke fails, auth is broken.

### 4. Exclude when unhealthy

When any check fails:

```bash
gad runtime exclude codex-cli --reason "health-preflight-failed" --task-types test-repair
gad state log "codex-cli-runtime-preflight: preflight failed, excluded from dispatch"
```

### 5. Continue with fallback

Dispatch to fallback runtime (claude-code, gemini-cli, or opencode).

## Failure modes

- **codex-cli hangs on preflight:** Set 30s timeout.
- **Installed but API key revoked:** Smoke prompt catches this.
- **Partial failures:** Log per-task-type status.

## References

- Candidate: `.planning/candidates/environment-bootstrap-skill-codex-cli-test-repair-environment-pressure/CANDIDATE.md`
- Related: `claude-code-runtime-preflight`, `gemini-cli-runtime-preflight`
- Decision gad-XXX: runtime preflight before dispatch
