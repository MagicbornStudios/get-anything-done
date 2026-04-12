# Phase 35 - Cross-runtime identity + telemetry attribution · PLAN

**Phase:** 35
**Status:** planned
**Depends on:** 25 (trace schema v4), 32 (self-eval pipeline)
**Blocks:** 36 (per-eval-repo — consumes runtime fields in TRACE.json)
**Decisions referenced:** GAD-D-137 (primary), GAD-D-50, GAD-D-53, GAD-D-55, GAD-D-58, GAD-D-104, GAD-D-142

---

## Goal

Extend eval telemetry so TRACE.json and related logs record the coding agent runtime
identity that produced a run, with strong provenance. Runtime-derived identity (env
vars, CLI version probes, spawning-process signals) is the authoritative source;
self-declared identity is secondary metadata. Claude Code and Codex are first-class
targets; the schema must extend cleanly to Cursor, Aider, and future runtimes.

Claude-vs-Codex comparisons must be first-class in aggregated eval reporting and on
the site. Phase 36 depends on the `runtime` field being populated at scaffold time.

## Definition of done

Phase 35 is done when:

1. `lib/runtime-identity.cjs` exists and returns a structured `RuntimeIdentity` object
   from pure environment inspection (no agent self-report).
2. `bin/gad.cjs evalRun` (and the upcoming `eval start`) populates `runtime` in the
   TRACE.json scaffold at run creation time.
3. `trace-schema.cjs` documents the `runtime` field and validates it.
4. Running `gad eval start` under Claude Code produces a TRACE.json where
   `runtime.primary.cli_name === "claude-code"` with non-null `session_id` and
   `provenance.source === "env:CLAUDE_CODE_SESSION_ID"` (or equivalent).
5. Running under Codex produces `runtime.primary.cli_name === "codex"` with an
   equivalent provenance chain.
6. Running under an unknown runtime produces `runtime.primary.cli_name === "unknown"`
   with `provenance.source === "none"` and does NOT crash.
7. Self-eval aggregator groups runs by `runtime.primary.cli_name` and emits a
   Claude-vs-Codex comparison block consumed by the site data pipeline.
8. Per-run pages on the portfolio site display a runtime badge sourced from
   `runtime.primary.cli_name` + `runtime.primary.cli_version`.
9. Tests cover the detection matrix for Claude Code, Codex, and unknown, plus the
   schema validator.

## Runtime identity schema (proposal)

```jsonc
// TRACE.json additive field
"runtime": {
  "schema_version": 1,
  "primary": {
    // runtime-derived — the authoritative identity
    "cli_name": "claude-code" | "codex" | "cursor" | "aider" | "unknown",
    "cli_version": "0.4.12" | null,
    "provider": "anthropic" | "openai" | "cursor" | null,
    "model": "claude-opus-4-6" | "gpt-5-codex" | null,  // null if not detectable
    "session_id": "<runtime-specific id or null>",
    "process_name": "claude" | "codex" | null,
    "detected_at": "2026-04-10T12:34:56Z"
  },
  "provenance": {
    // how primary.cli_name was determined — trust ranking
    "source": "env:CLAUDE_CODE_SESSION_ID"
            | "env:CODEX_SESSION"
            | "cli-probe:claude --version"
            | "cli-probe:codex --version"
            | "process-ancestry"
            | "self-declared"  // fallback only
            | "none",
    "confidence": "high" | "medium" | "low",
    "signals": [
      // ordered list of every signal inspected, with hit/miss
      { "kind": "env", "name": "CLAUDE_CODE_SESSION_ID", "hit": true,  "value_hash": "sha256:..." },
      { "kind": "env", "name": "CODEX_SESSION",          "hit": false },
      { "kind": "cli", "cmd": "claude --version",        "hit": true,  "value": "0.4.12" }
    ]
  },
  "self_declared": {
    // secondary metadata — the agent may fill this at session start
    // lower trust; kept for cross-check with `primary`
    "cli_name": null,
    "model": null,
    "declared_at": null,
    "agrees_with_primary": null   // bool, computed post-hoc
  }
}
```

**Design notes:**

- `schema_version` lives inside `runtime` so the field can evolve without touching
  `trace_schema_version` (currently 4).
- `primary` is populated at scaffold time by `lib/runtime-identity.cjs`. Never
  overwritten by the agent.
- `self_declared` is optional and populated by the agent via `gad eval trace write`
  or a dedicated `gad eval declare-runtime` subcommand (out of scope for this phase
  unless trivial).
- `provenance.signals` is intentionally verbose — we want the audit trail for
  decisions gad-137 and gad-55. Values are hashed where they may contain secrets
  (session IDs).
- `cli_name` is a closed enum plus `"unknown"`. New runtimes ship as enum additions
  with a corresponding detector in `lib/runtime-identity.cjs`.

## Detection matrix

| Runtime      | Primary signal (env)            | Secondary (CLI probe)  | Process name   |
|--------------|---------------------------------|------------------------|----------------|
| claude-code  | `CLAUDE_CODE_SESSION_ID`, `CLAUDECODE=1` | `claude --version`     | `claude`       |
| codex        | `CODEX_SESSION`, `CODEX_HOME`   | `codex --version`      | `codex`        |
| cursor       | `CURSOR_AGENT_VERSION`, `CURSOR_TRACE_ID` | `cursor-agent --version` | `cursor-agent` |
| aider        | `AIDER_*`                       | `aider --version`      | `aider`        |
| unknown      | —                               | —                      | —              |

Exact env-var names MUST be verified against the runtime's source at implementation
time. The detector must fail closed (return `unknown`) rather than guess.

## Task breakdown

**Task attribution (GAD-D-104 per GAD-D-142 framework-workflow scope):**
`skill="execute-phase" agent="gad-executor" type="framework"` on every task below.

### Milestone A — runtime detection library (35-01)

**35-01** — Create `vendor/get-anything-done/lib/runtime-identity.cjs`.

- Export `detectRuntime(opts)` returning a `RuntimeIdentity` object matching the
  schema above.
- Inputs: optional `{ env, execSync }` for test injection. Defaults to
  `process.env` and `child_process.execSync`.
- Detection order (highest trust first):
  1. Runtime-specific env vars from the detection matrix.
  2. CLI version probe (`<cli> --version`, 2s timeout, best-effort).
  3. Parent process name where cheaply detectable on win32/linux/darwin.
  4. Return `unknown` if all signals miss.
- Never throw: wrap every probe in try/catch and append a `signal` entry with
  `hit: false` and the error class.
- Hash session-id-like values with `sha256` truncated to 16 hex chars so raw IDs
  never land in TRACE.json.
- Unit tests at `vendor/get-anything-done/test/runtime-identity.test.cjs` covering:
  - Claude Code env present → `primary.cli_name === "claude-code"`
  - Codex env present → `primary.cli_name === "codex"`
  - Both present → claude-code wins (document precedence in code comment + test)
  - Neither present, no CLIs on PATH → `unknown` with `confidence: "low"`
  - CLI probe path: stub `execSync` to return a version string
  - execSync throws → no exception escapes; signal recorded `hit: false`

**Files touched:**

- `vendor/get-anything-done/lib/runtime-identity.cjs` (new)
- `vendor/get-anything-done/test/runtime-identity.test.cjs` (new)

**Verify:** `node --test vendor/get-anything-done/test/runtime-identity.test.cjs`

**Done when:** all 6+ test cases pass; running
`node -e "console.log(require('./vendor/get-anything-done/lib/runtime-identity.cjs').detectRuntime())"`
from the repo root prints a `RuntimeIdentity` object with a populated
`provenance.signals` array.

---

### Milestone B — TRACE.json scaffold + schema (35-02)

**35-02** — Wire `detectRuntime()` into the TRACE scaffold in `bin/gad.cjs`.

- In `evalRun` around line 1678, import `runtime-identity.cjs` and call
  `detectRuntime()` before constructing `traceScaffold`.
- Add `runtime: detectRuntime()` to `traceScaffold`.
- Update `lib/trace-schema.cjs` to document the `runtime` field and add validation:
  - `runtime.schema_version` must be `1`.
  - `runtime.primary.cli_name` must be one of the closed enum values.
  - `runtime.provenance.source` must be one of the enumerated sources.
  - Presence is REQUIRED for runs created after this phase (legacy runs grandfathered).
- Add a `gad eval trace show` formatter branch that prints the runtime block as a
  dedicated section (not buried in JSON).

**Files touched:**

- `vendor/get-anything-done/bin/gad.cjs` (evalRun scaffold + trace show)
- `vendor/get-anything-done/lib/trace-schema.cjs`
- `vendor/get-anything-done/test/trace-schema.test.cjs` (extend)

**Verify:**
1. `node vendor/get-anything-done/bin/gad.cjs eval run --project escape-the-dungeon-bare --prompt-only`
   produces a TRACE.json with a populated `runtime` block.
2. `node --test vendor/get-anything-done/test/trace-schema.test.cjs` passes.
3. `gad eval trace show <project> v<N>` renders the runtime section.

**Done when:** a newly scaffolded TRACE.json under Claude Code shows
`runtime.primary.cli_name === "claude-code"` and schema validator accepts it.

---

### Milestone C — hook + install wiring preserves runtime metadata (35-03)

**35-03** — Ensure eval agent sessions preserve enough metadata to attribute every
tool call, skill invocation, and agent spawn to the runtime recorded in
`runtime.primary`.

- Audit `bin/gad-trace-hook.cjs` (GAD-D-59) and confirm every appended event
  inherits `runtime.primary.cli_name` via the TRACE.json the hook reads at startup
  (NOT by re-detecting; single source of truth).
- Where the hook currently writes only `{ tool, args, outputs }`, add a
  `runtime_cli` field copied from TRACE.json once at hook init.
- `install.js` updated so `--claude` and `--codex` install flows each drop a marker
  file (`.planning/.runtime-hint`) the detector can use as a tie-breaker when env
  vars are ambiguous. The detector's `signals` array records the hint with
  `kind: "marker"`.
- `gad eval auto --runtime <name>` (to be implemented in phase 36) will set
  `GAD_EVAL_DECLARED_RUNTIME=<name>` — the detector reads this as the lowest-trust
  signal and records it under `self_declared`, never under `primary`.

**Files touched:**

- `vendor/get-anything-done/bin/gad-trace-hook.cjs`
- `vendor/get-anything-done/bin/install.js`
- `vendor/get-anything-done/lib/runtime-identity.cjs` (marker + GAD_EVAL_DECLARED_RUNTIME handling)
- `vendor/get-anything-done/test/runtime-identity.test.cjs` (extend)

**Verify:**
1. Tail `.trace-events.jsonl` on a live scaffolded run and confirm each event has
   a `runtime_cli` field.
2. Install via `--claude`, delete env vars, rerun detection — `primary.cli_name`
   still resolves to `claude-code` via the marker file with
   `provenance.confidence: "medium"`.
3. With only `GAD_EVAL_DECLARED_RUNTIME=codex`, detection returns `unknown` in
   `primary` and `codex` in `self_declared`.

**Done when:** trace events carry runtime attribution; marker + declared-runtime
precedence rules pass their tests.

---

### Milestone D — self-eval aggregation + Claude-vs-Codex comparison (35-04)

**35-04** — Teach `gad self-eval` and the site data generator to group by runtime.

- Aggregator in `vendor/get-anything-done/lib/score-generator.cjs` (or the closest
  existing module) walks TRACE.json files and buckets them by
  `runtime.primary.cli_name`.
- Emit a new `runtime_comparison` block in the generated self-eval output:

  ```jsonc
  "runtime_comparison": {
    "by_runtime": {
      "claude-code": { "runs": N, "avg_tokens": …, "avg_tools": …, "avg_score": …, "avg_duration_min": … },
      "codex":       { "runs": M, "avg_tokens": …, "avg_tools": …, "avg_score": …, "avg_duration_min": … }
    },
    "claude_vs_codex": {
      "eligible_runs": [...],       // runs where both have a v of the same eval+round
      "delta": { "tokens": …, "score": …, "duration_min": … }
    }
  }
  ```

- Legacy runs with no `runtime` field are bucketed as `legacy` and excluded from
  the comparison delta.
- `gad self-eval` prints a summary table when `--runtime-comparison` is passed.

**Files touched:**

- `vendor/get-anything-done/lib/score-generator.cjs` (or new `lib/runtime-aggregator.cjs`)
- `vendor/get-anything-done/bin/gad.cjs` (self-eval subcommand surface)
- `vendor/get-anything-done/test/runtime-aggregator.test.cjs` (new)

**Verify:** fixtures with 2 Claude runs + 2 Codex runs + 1 legacy run produce a
`runtime_comparison` block with the expected shape; `gad self-eval
--runtime-comparison` prints a table.

**Done when:** the generated site-data JSON has a `runtime_comparison` block and
tests pass.

---

### Milestone E — site rendering: runtime badge + comparison surface (35-05)

**35-05** — Surface runtime identity on the portfolio site.

- Per-run page (`apps/portfolio` — locate current per-run component) renders a
  `<RuntimeBadge runtime={trace.runtime.primary} />` showing
  `cli_name` + `cli_version` + a provenance tooltip.
- Per-project round pages render aggregate counts: "3 runs · 2 claude-code · 1 codex".
- A new section on `/methodology` (or the existing eval methodology page) explains
  runtime-derived vs self-declared identity, linking to GAD-D-137.
- Legacy runs render a neutral `legacy` badge with a tooltip explaining the
  grandfather rule.

**Files touched:**

- `apps/portfolio/**` — the per-run, per-project, and methodology components
  (exact paths determined at execute time; grep for existing `TRACE.json` usage)
- Probable: `apps/portfolio/lib/eval-data.ts` or equivalent aggregator in the
  portfolio build pipeline

**Verify:** build portfolio; a run produced under Claude Code shows the
`claude-code 0.4.12` badge; a legacy run shows `legacy`; methodology page links
to GAD-D-137.

**Done when:** `pnpm --filter portfolio build` succeeds with runtime badges
present on per-run pages and comparison counts on round pages.

---

### Milestone F — end-to-end smoke + docs (35-06)

**35-06** — Full-loop smoke test and documentation.

- Run `gad eval run --project escape-the-dungeon-bare --prompt-only` under
  Claude Code, inspect TRACE.json, confirm primary is `claude-code`.
- If a Codex CLI is available in the environment, repeat under Codex and confirm
  `primary.cli_name === "codex"`.
- Update `vendor/get-anything-done/docs/eval-telemetry.md` (create if absent) with
  a runtime-identity section: schema, detection order, how to extend for a new
  runtime, and the trust hierarchy diagram.
- Update `DECISIONS.xml` with any new sub-decisions surfaced during implementation
  (e.g. exact env-var names chosen).
- Mark 35-01 through 35-06 as done in TASK-REGISTRY.xml, update STATE.xml
  next-action to point at phase 36, commit.

**Files touched:**

- `vendor/get-anything-done/docs/eval-telemetry.md` (likely new)
- `vendor/get-anything-done/.planning/TASK-REGISTRY.xml`
- `vendor/get-anything-done/.planning/STATE.xml`
- `vendor/get-anything-done/.planning/DECISIONS.xml` (if new decisions emerge)

**Verify:** smoke-test TRACE.json committed as a fixture under
`vendor/get-anything-done/test/fixtures/trace-runtime-claude.json`.

**Done when:** phase 36 planning can consume `runtime.primary.cli_name` without
further schema changes.

---

## Risks and open questions

1. **Exact env-var names.** Claude Code and Codex env-var names must be verified
   against current releases at 35-01 implementation time. If the preferred vars
   change between Claude Code versions, the detector must accept either and record
   which matched in `provenance.signals`.
2. **Process ancestry on Windows.** Cheap detection of parent process name on
   Windows is non-trivial. Treat as best-effort; unit-test the linux/darwin paths
   and stub win32.
3. **Self-declared precedence.** `self_declared` MUST never overwrite `primary`.
   The aggregator in 35-04 cross-checks and emits a warning when they disagree;
   the site can render an indicator if disagreement is detected.
4. **Backfill.** Legacy TRACE.json files remain unmigrated. 35-04 buckets them as
   `legacy`; a future backfill task (out of scope) may re-stamp them from git
   history where the commit author hints at the runtime.
5. **Cursor and Aider.** Schema is extensible but detectors are NOT implemented
   in this phase. Enum reserves the slots; detectors return `unknown` until a
   future phase adds them.
