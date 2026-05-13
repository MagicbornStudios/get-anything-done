# Phase 106: Runtime Budget Prediction + Token Cost as Pressure Dimension

## Goal

Build a prediction system that uses worker log.jsonl token data (input/output/cache.read/cache.write per call, totals per session) to predict:

1. **Which worker will rate-limit next + when** (next rate-limit ETA)
2. **Cost-per-handoff distribution** by handoff-type and runtime
3. **Optimal handoff-to-worker routing** given current quota state
4. **Token-cost-per-task as a pressure dimension** in Skill Entropy / pressure calculation (phase 88) — high-token-cost recurring patterns indicate substrate friction worth resolving via skill creation

Surface the prediction in `gad team status` as a "next rate-limit ETA" column. Persist token-cost histograms per task-type for future tasks of the same shape.

**Sources:** every worker logs token counts per LLM call; aggregate at handoff close + persist to `.planning/.gad-log/token-budgets.jsonl`.

**Dependencies:** phase 87 (multi-runtime fallback), phase 88 (Skill Entropy formalization), phase 89 (session telemetry). Phase 103 (AI Gateway spend tracking) is a parallel platform-level concern — phase 106 is the *framework-local* budget prediction layer that feeds the same raw token data from a different angle (worker logs vs. Gateway API responses).

## What exists today (substrate)

### Token extraction already works
- `bin/commands/telemetry.cjs` already extracts token fields from multiple log sources (whiteboard events.jsonl, .gad-log/*.jsonl, .trace-events.jsonl, worker log.jsonl) via `extractTokensFromEntry()` — normalizes `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens` across inconsistent field names from different runtimes.
- `telemetry.cjs` already loads `model-pricing-snapshot.json` via `loadPricingSnapshot()` and builds a pricing index via `buildPricingIndex()`, then estimates USD per call via `estimateUsd()`.
- Telemetry already buckets records into token-volume and estimated-cost histograms (`buildHistogramSummary()`).

### Pressure compute exists (MVP)
- `lib/entropy/compute.cjs` aggregates observable signals (rate-limit incidents, unclaim history, open handoff backlog, worker failures, ERRORS-AND-ATTEMPTS) into a 0-1 pressure score with per-phase breakdown.
- Does NOT yet include token cost as a signal dimension.

### Worker logging gap
- `lib/team/worker-loop.cjs` writes `work-complete` events with `exit_code`, `rate_limited`, `duration_ms`, `stdout_bytes`, `stderr_bytes` — but **does not currently parse or log token counts** from the runtime's stdout. This is the key data gap: runtimes emit token usage in their JSON output, but the worker loop doesn't capture it.

### No model-pricing snapshot exists on disk
- `model-pricing-snapshot.json` is referenced by telemetry.cjs but no file exists at `.planning/model-pricing-snapshot.json`. This must be scaffolded or generated.

### `gad team status` has no budget column
- `lib/team/status.cjs` renders worker state but has no rate-limit ETA or budget-cost columns.

## Evidence summary

1. **Telemetry already has the cost estimation pipeline** — `telemetry.cjs:232-241` (`estimateUsd`) and `telemetry.cjs:205-221` (`buildPricingIndex`) are production-ready for local token-to-cost conversion. Phase 106 reuses this, doesn't rebuild it.

2. **Worker logs lack token parsing** — `worker-loop.cjs:272-280` writes work-complete without token fields. The runtime subprocess stdout contains JSON with usage data; it needs to be parsed and appended to the work-complete event.

3. **Pressure formula is extensible** — `compute.cjs:177-248` (`aggregatePressure`) uses a weighted-signal pattern; adding a token-cost signal is a matter of adding signal 6 to the existing list.

4. **Phase 103 is platform billing, phase 106 is framework budgeting** — they share the token-cost data model but serve different consumers. Phase 103 captures per-customer Gateway API spend for Stripe billing; phase 106 predicts operator-side framework costs and rate-limit risk from worker logs. The integration point: both write to / read from the same token-cost histogram shape.

## Top 6 implementation targets

### P0 — Target 1: Worker log token capture

**Why first**

All downstream prediction depends on having token data in the worker log. Without this, there is no signal to predict from.

**Planned outcome**

- `lib/team/worker-loop.cjs` parses the runtime subprocess stdout for token usage fields after each work-complete.
- `work-complete` events include `tokens: { input, output, cache_read, cache_write }` alongside existing fields.
- Reuses the normalization logic pattern from `telemetry.cjs:extractTokensFromEntry()` — extract into a shared `lib/team/token-parse.cjs` module so both telemetry and worker-loop use the same extraction code.

**Primary files**

- `lib/team/worker-loop.cjs`
- `lib/team/token-parse.cjs` (new — shared token extraction)
- `lib/team/subprocess.cjs` (may need to capture full stdout JSON for parsing)

**Verification**

- Run a handoff via `gad team dispatch`, inspect the resulting worker log.jsonl — work-complete entries have token fields.
- `node --test lib/team/__tests__/token-parse.test.cjs`

### P0 — Target 2: Model pricing snapshot scaffolding + CLI

**Why second**

Cost estimation requires a pricing index. Since no `model-pricing-snapshot.json` exists on disk, we need a way to generate/maintain it.

**Planned outcome**

- `gad budget pricing fetch` (or `gad budget pricing update`) fetches current model pricing from known provider APIs (OpenRouter, Anthropic, Google) or accepts a manual `--file` path to a JSON pricing file.
- Writes `.planning/model-pricing-snapshot.json` with the canonical shape: `{ generated_at, providers: { [provider]: { models: [{ id, input_per_m, output_per_m }] } } }`.
- Fallback default pricing baked into the module for common models (claude-sonnet-4-20250514, gpt-4o, gemini-2.5-pro) so cost estimation works even without an external fetch.

**Primary files**

- `bin/commands/budget.cjs` (new — budget command family)
- `lib/budget/pricing.cjs` (new — pricing snapshot management)
- `.planning/model-pricing-snapshot.json` (generated output)

**Verification**

- `node bin/gad.cjs budget pricing fetch --projectid global` writes a valid snapshot file.
- `node bin/gad.cjs telemetry summary --json --projectid global` now shows non-zero `recordsMissingPricing` after pricing exists.

### P1 — Target 3: Token-cost budget aggregation + histogram persistence

**Why third**

Once token data flows into worker logs and pricing exists, we need a dedicated aggregation layer that produces the histograms the prediction system consumes.

**Planned outcome**

- `lib/budget/aggregate.cjs` reads worker log.jsonl files, applies the shared token extraction + pricing index, and produces per-runtime, per-phase, per-handoff-type histograms.
- Persists rolling aggregation to `.planning/.gad-log/token-budgets.jsonl` (append-only, one entry per handoff-close with totals).
- Exports `computeBudgetBaselines(projectid)` returning: `{ byRuntime, byPhase, byHandoffType, topCostCalls, totalEstimatedUsd, recordsAnalyzed }`.

**Primary files**

- `lib/budget/aggregate.cjs` (new)
- `lib/budget/` (new directory)
- Reuses `telemetry.cjs` extraction functions (should be moved to `lib/team/token-parse.cjs` from Target 1)

**Verification**

- After several completed handoffs, `token-budgets.jsonl` has entries.
- `computeBudgetBaselines('global')` returns structured histogram data.

### P1 — Target 4: Rate-limit prediction engine

**Why fourth**

This is the core prediction capability — using the aggregated budget data to forecast when a runtime will hit its rate limit.

**Planned outcome**

- `lib/budget/predict.cjs` computes:
  - **Per-runtime consumption rate**: tokens/minute or $/minute over the rolling window (last 24h from worker logs).
  - **Rate-limit ETA**: given the current consumption rate and the known quota window (runtime-specific: codex = hourly, claude = per-5-min, gemini = per-minute), estimate when the next rate-limit event will occur. Returns `null` if consumption is too low to predict.
  - **Optimal routing suggestion**: given the current handoff queue and predicted rate-limit ETAs, suggest which worker should take the next handoff to minimize total wait time.
- Writes predictions to `.planning/.gad-log/budget-predictions.jsonl` (append-only, one entry per prediction cycle).

**Primary files**

- `lib/budget/predict.cjs` (new)
- `lib/team/rate-limit.cjs` (extend with quota window constants per runtime)

**Verification**

- Given synthetic worker logs with accelerating token consumption, `predictRateLimitEta('codex-cli')` returns a reasonable ETA.
- `suggestOptimalWorker(handoffQueue, predictions)` returns a worker id that avoids the soonest-rate-limited runtime.

### P1 — Target 5: `gad team status` budget column + `gad budget` CLI surface

**Why fifth**

The prediction system needs an operator-facing surface. `gad team status` is the canonical team view.

**Planned outcome**

- `gad team status` gains a "budget" column showing:
  - `next-rl-eta`: estimated time until next rate-limit for each active worker's runtime (e.g. "4.2m", "12m", "N/A").
  - `session-cost`: estimated USD spent by this worker in its current session.
- `gad budget status` (new subcommand) shows the full budget prediction summary: total session cost, per-runtime breakdown, top cost calls, predicted rate-limit events.
- `gad budget history [--since 7d] [--phase N]` shows historical token-cost data from `token-budgets.jsonl`.

**Primary files**

- `lib/team/status.cjs` (extend table rendering)
- `bin/commands/budget.cjs` (extend with status + history subcommands)

**Verification**

- `node bin/gad.cjs team status` shows budget columns when worker logs have token data.
- `node bin/gad.cjs budget status` renders a human-readable budget summary.

### P2 — Target 6: Token cost as pressure dimension in Skill Entropy

**Why last**

This is the integration with phase 88's pressure system. It depends on all upstream targets producing reliable cost data.

**Planned outcome**

- `lib/entropy/compute.cjs` gains signal 6: **token cost pressure**.
  - High-token-cost recurring patterns for the same task type indicate substrate friction (the agent is burning tokens because it doesn't have the right skill/knowledge).
  - Weighted contribution: `tokenCostPressure = clamp(totalSessionCostUsd / costThreshold, 0, 1)` where `costThreshold` is configurable (default: $5.00/session).
  - Per-phase: bump phase score proportional to the token cost attributed to that phase's handoffs.
- The pressure score now reflects not just failure events and backlog but also *economic* friction — expensive phases get flagged for skill creation.
- Phase 106 cross-references with phase 88: the pressure formula document (`references/pressure-formula.md`) gets updated with the new token cost dimension.

**Primary files**

- `lib/entropy/compute.cjs` (extend aggregatePressure with signal 6)
- `references/pressure-formula.md` (document new dimension)

**Verification**

- After a session with high token cost, `computePressure('global')` returns a higher score than before.
- The pressure breakdown includes a `token_cost` field.

## Execution order

### Wave 1 — Data foundation

1. Target 1: Worker log token capture (unblocks everything downstream)
2. Target 2: Model pricing snapshot scaffolding (unblocks cost estimation)

These can be developed in parallel since they touch different modules.

### Wave 2 — Aggregation + prediction

3. Target 3: Token-cost budget aggregation + histogram persistence
4. Target 4: Rate-limit prediction engine

Wave 2 depends on Wave 1 completing. Targets 3 and 4 can be developed in parallel.

### Wave 3 — Surfaces + integration

5. Target 5: `gad team status` budget column + `gad budget` CLI
6. Target 6: Token cost as pressure dimension in Skill Entropy

Wave 3 depends on Wave 2. Target 6 depends on Target 5's data being available.

## Non-goals

- No platform billing integration (that's phase 103's concern).
- No AI Gateway API integration — phase 106 reads worker-local logs, not Gateway responses.
- No changes to the runtime subprocess contract (only parsing existing stdout).
- No rebuild of `gad.exe` during this planning handoff.

## Link to upstream phases

| Phase | Relationship |
|-------|-------------|
| 87 (multi-runtime fallback) | Prediction engine informs fallback decisions — route away from runtime predicted to rate-limit soon |
| 88 (Skill Entropy) | Token cost becomes signal 6 in the pressure formula |
| 89 (session telemetry) | Shares the same log sources; telemetry.cjs already extracts tokens — phase 106 reuses that extraction |
| 103 (AI Gateway cost attribution) | Parallel concern: 103 captures per-customer Gateway spend for billing; 106 predicts operator-side framework costs from worker logs. Both consume the same token-cost histogram shape |
| 107 (evolution agent + pressure visibility) | TUI pressure panel (107) renders the score that 106 extends with token cost |

## Suggested task decomposition

1. `106-01`: Create `lib/team/token-parse.cjs` — shared token extraction from runtime stdout JSON. Wire into `worker-loop.cjs` so `work-complete` events include token fields.
2. `106-02`: Create `lib/budget/pricing.cjs` + `gad budget pricing fetch` CLI. Scaffold default pricing for common models. Write `.planning/model-pricing-snapshot.json`.
3. `106-03`: Create `lib/budget/aggregate.cjs` — read worker logs, apply pricing, produce per-runtime/per-phase histograms. Persist to `.planning/.gad-log/token-budgets.jsonl`.
4. `106-04`: Create `lib/budget/predict.cjs` — rate-limit ETA prediction, optimal routing suggestion based on consumption rates and quota windows.
5. `106-05`: Extend `gad team status` with budget column (next-rl-eta, session-cost). Add `gad budget status` and `gad budget history` subcommands.
6. `106-06`: Extend `lib/entropy/compute.cjs` with token cost as signal 6 in `aggregatePressure()`. Update `references/pressure-formula.md`.
