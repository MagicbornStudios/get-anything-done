# exclude-unhealthy-runtime-from-matrix workflow

## Purpose

Prevent failed runtime health/auth/contract checks from polluting benchmark
matrix scores. Instead of recording a "failure" (which could mean many
things), explicitly label the runtime as "blocked" so the matrix
reflects "could not run" rather than "ran and failed".

## When to trigger

- Before any cross-runtime benchmark or eval matrix run
- When a runtime fails install/auth/JSON contract precheck
- When `gad runtime check <runtime>` returns anything other than "ok"
- During eval species setup (before `gad species run`)

## Steps

### 1. Run precheck on each runtime in matrix

```bash
for runtime in claude-code gemini-cli codex-cli opencode; do
  gad runtime check "$runtime" --json
done
```

Expected output per runtime:
```json
{"runtime": "claude-code", "status": "ok", "auth": "valid", "contract": "ok"}
{"runtime": "gemini-cli", "status": "blocked", "reason": "auth_failure"}
```

### 2. Label blocked runtimes in matrix

For any runtime with status != "ok":

```bash
gad runtime matrix exclude "$runtime" --reason "$reason" --label blocked
```

This removes the runtime from scoring calculations and marks it as
"blocked" in the matrix output (not "failed").

### 3. Continue benchmark with healthy runtimes only

The matrix now contains only runtimes that passed precheck.
Proceed with `gad species run` or `gad eval run` as planned.

### 4. Report blocked status

At the end of the benchmark, the matrix report should show:

| Runtime | Status | Reason |
|---------|--------|--------|
| claude-code | scored | — |
| gemini-cli | blocked | auth_failure |
| codex-cli | scored | — |

This makes it clear that gemini-cli was not compared (blocked), rather
than compared and found worse (failed).

## Failure modes

- **All runtimes blocked:** Stop the benchmark. No point comparing
  nothing. Report "all runtimes blocked" and exit.
- **Precheck hangs:** Set 60s timeout per runtime. Log and mark as
  blocked if timeout exceeded.
- **Matrix already has results:** If re-running with new precheck,
  clear previous blocked labels first:
  `gad runtime matrix include "$runtime" --clear-labels`.

## References

- Candidate: `.planning/candidates/exclude-unhealthy-runtime-from-matrix/CANDIDATE.md`
- Related: `gemini-headless-auth-preflight`
- Decision gad-XXX: blocked vs failed distinction in eval matrices
