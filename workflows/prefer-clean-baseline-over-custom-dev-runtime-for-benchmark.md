# prefer-clean-baseline-over-custom-dev-runtime-for-benchmark workflow

## Purpose

Mark benchmark validity as degraded when runtime version is a custom
dev build. Prefer clean tagged baseline releases for cross-runtime
comparisons to ensure reproducibility and fair comparison.

## When to trigger

- Setting up a benchmark or eval matrix
- Before `gad species run` or `gad eval run`
- When runtime version string contains "dev", "custom", or untagged commit
- When benchmark results seem inconsistent across runs

## Steps

### 1. Check runtime versions

```bash
for runtime in claude-code gemini-cli codex-cli opencode; do
  gad runtime version "$runtime" --json
done
```

Expected clean version:
```json
{"runtime": "claude-code", "version": "1.2.3", "tag": "v1.2.3", "clean": true}
```

Custom/dev version:
```json
{"runtime": "opencode", "version": "0.0.0-dev", "tag": "custom-build", "clean": false}
```

### 2. Tag non-clean runtimes

For any runtime with `"clean": false`:

```bash
gad runtime tag "$runtime" --benchmark-validity degraded --reason "custom-dev-build"
gad state log "prefer-clean-baseline: $runtime marked degraded (custom dev build)"
```

### 3. Prefer clean baseline in matrix

When building the benchmark matrix, prefer clean runtimes:

```bash
# Get clean runtimes for primary comparison
CLEAN_RUNTIMES=$(gad runtime list --clean-only --json | jq -r '.[].runtime')

# Run benchmark with clean only
gad species run <species-slug> --runtimes "$CLEAN_RUNTIMES"
```

### 4. Note degraded validity in report

Benchmark report should note:

| Runtime | Version | Benchmark Validity |
|---------|---------|-------------------|
| claude-code | 1.2.3 | clean |
| opencode | 0.0.0-dev | **degraded** (custom build) |

## Failure modes

- **All runtimes are custom builds:** Tag as "all-degraded", but run
  anyway with clear warning in report.
- **Version check fails:** Default to assuming clean. Log the failure.
- **Mixed clean/degraded in same matrix:** Compare within groups
  (clean vs clean), not across groups.

## References

- Candidate: `.planning/candidates/prefer-clean-baseline-over-custom-dev-runtime-for-benchmark/CANDIDATE.md`
- Related: `exclude-unhealthy-runtime-from-matrix`
- Decision gad-XXX: clean baseline preferred for benchmark validity
