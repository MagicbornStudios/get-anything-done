# normalize-cli-contracts-before-eval workflow

## Purpose

Ensure all cross-runtime evaluations run through adapter-normalized
input/output contracts and normalized error codes before scoring.
Prevents false negatives caused by contract mismatches rather than
actual runtime performance differences.

## When to trigger

- Before any cross-runtime eval or benchmark run
- When setting up a new eval species
- Before `gad species run` or `gad eval run`
- When error codes differ between runtimes for the same failure

## Steps

### 1. Normalize input contracts

Ensure all runtimes receive the same input format:

```bash
gad runtime normalize-input --species <species-slug> --adapters all
```

This rewrites task prompts to be runtime-agnostic (no
runtime-specific syntax in the prompt).

### 2. Normalize output contracts

Ensure all runtimes produce output in the same format:

```bash
gad runtime normalize-output --species <species-slug> --format json
```

Expected: all runtimes output valid JSON with same schema.

### 3. Normalize error codes

Map runtime-specific errors to canonical error codes:

| Runtime error | Canonical code |
|---------------|----------------|
| auth_failure (gemini) | AUTH_FAIL |
| invalid_key (codex) | AUTH_FAIL |
| permission_denied | PERM_BLOCK |
| context_overflow | CTX_OVERFLOW |
| format_mismatch | FMT_CONTRACT_FAIL |

```bash
gad runtime normalize-errors --species <species-slug> --mapping canonical
```

### 4. Verify normalization before scoring

```bash
gad runtime verify-contracts --species <species-slug> --json
```

Output should show all runtimes: "contract: normalized".

### 5. Run eval with normalized contracts

Now safe to run:
```bash
gad species run <species-slug>
```

Scoring will reflect actual runtime performance, not contract mismatches.

## Failure modes

- **Runtime doesn't support adapter:** Skip that runtime or
  exclude from matrix. Log: `gad state log "runtime X skipped: no adapter"`
- **Normalization changes task semantics:** Review normalized prompts
  before running eval. Don't let normalization break the task.
- **Error mapping incomplete:** Add new mappings to
  `.planning/references/error-code-mapping.json`.

## References

- Candidate: `.planning/candidates/normalize-cli-contracts-before-eval/CANDIDATE.md`
- Related: `exclude-unhealthy-runtime-from-matrix`
- Decision gad-XXX: normalized contracts for fair eval comparison
