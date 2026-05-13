# claude-code-test-repair-runtime-preflight workflow

## Purpose

Before selecting claude-code for test-repair tasks, run a runtime health
and auth preflight. Exclude claude-code from dispatch when unhealthy.
Addresses environment pressure 104 with 0% success rate observed over
26 runs.

## When to trigger

- Task dispatch is choosing claude-code for test-repair tasks
- `gad` CLI is about to spawn claude-code for test-repair
- Any automation that invokes `claude-code` without health check

## Steps

### 1. Check claude-code installation

```bash
which claude-code || command -v claude-code || echo "NOT_INSTALLED"
```

If not installed, skip to step4 (exclude).

### 2. Run health preflight

```bash
gad runtime check claude-code --json
```

Expected healthy output:
```json
{"runtime": "claude-code", "status": "ok", "auth": "valid"}
```

### 3. Test auth with smoke prompt

```bash
echo "respond with: OK" | claude-code --headless --quiet 2>&1 | grep -i "OK"
```

Set 30s timeout. If smoke fails, auth is broken.

### 4. Exclude when unhealthy

When any check fails:

```bash
gad runtime exclude claude-code --reason "health-preflight-failed" --task-types test-repair
gad state log "claude-code-test-repair-preflight: preflight failed, excluded from dispatch"
```

### 5. Continue with fallback

Dispatch to fallback runtime (gemini-cli, codex-cli, or opencode).

## Failure modes

- **claude-code hangs on preflight:** Set 30s timeout.
- **Installed but API key revoked:** Smoke prompt catches this.
- **High environment pressure (104):** This runtime has significant issues
  with test-repair. Consider permanent exclusion for this task type.

## References

- Candidate: `.planning/candidates/environment-bootstrap-skill-claude-code-test-repair-environment-pressure/CANDIDATE.md`
- Related: `claude-code-runtime-preflight`
- Decision gad-XXX: runtime preflight before dispatch
