# claude-code-runtime-preflight workflow

## Purpose

Before selecting claude-code for planning or test-repair tasks, run a
runtime health and auth preflight. Exclude claude-code from dispatch
when unhealthy. Addresses environment pressure 28 (planning) and 104
(test-repair) with 0% success rates observed.

## When to trigger

- Task dispatch is choosing claude-code for planning tasks
- Task dispatch is choosing claude-code for test-repair tasks
- `gad` CLI is about to spawn claude-code
- Any automation that invokes `claude-code` without health check

## Steps

### 1. Check claude-code installation

```bash
which claude-code || command -v claude-code || echo "NOT_INSTALLED"
```

If not installed, skip to step 4 (exclude).

### 2. Run health preflight

```bash
gad runtime check claude-code --json
```

Expected healthy output:
```json
{"runtime": "claude-code", "status": "ok", "auth": "valid"}
```

### 3. Test auth with smoke prompt (planning tasks)

For planning tasks specifically, run a minimal smoke test:

```bash
echo "respond with: OK" | claude-code --headless --quiet 2>&1 | grep -i "OK"
```

If smoke fails, auth is broken despite installation.

### 4. Exclude when unhealthy

When any check fails:

```bash
gad runtime exclude claude-code --reason "health-preflight-failed" --task-types planning,test-repair
gad state log "claude-code-runtime-preflight: preflight failed, excluded from dispatch"
```

### 5. Continue with fallback

Dispatch to fallback runtime (gemini-cli, codex-cli, or opencode depending on task type).

## Failure modes

- **claude-code hangs on preflight:** Set 60s timeout.
- **Installed but API key revoked:** Smoke prompt catches this.
- **Partial failure (works for planning, fails test-repair):** Log per-task-type status.

## References

- Candidate: `.planning/candidates/environment-bootstrap-skill-claude-code-planning-environment-pressure/CANDIDATE.md`
- Candidate: `.planning/candidates/environment-bootstrap-skill-claude-code-test-repair-environment-pressure/CANDIDATE.md`
- Related: `gemini-headless-auth-preflight`
- Decision gad-XXX: runtime preflight before dispatch
