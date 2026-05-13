# Phase 75: Runtime Launch Hardening - Follow-up Plan

## Goal

Close the remaining runtime-launch and standing-worker reliability gaps after the first phase-75 pass. Focus on the failures seen in live team use this session: Codex local debug binary DLL init failures, Gemini wrapper contract drift, OpenCode runtime-path/capability drift, `just-try-it` handoffs that stay claimed after wrapper/process failures like exit `127`, and dispatcher routing to workers that are already stopped or stale.

This is a planning-only follow-up. No implementation is included in this artifact.

## What changed since the first pass

Tasks `75-01` through `75-05` landed the first hardening slice:

1. contradictory `runtime launch` flag validation
2. pre-launch dispatch logging
3. argv echoing
4. project-scoped CWD
5. smoke coverage

Those fixes hardened one-shot `gad runtime launch`, but they did not unify the runtime wrapper surfaces used by:

- `lib/runtime-launch.cjs`
- `lib/runtime-substrate-scripts.cjs`
- `lib/team/config.cjs`
- `lib/team/subprocess.cjs`
- `lib/team/worker-loop.cjs`
- `lib/team/dispatcher.cjs`
- root-level `scripts/{gad-,}{codex,gemini,opencode}-trial.mjs`

The current failures are therefore mostly cross-surface consistency bugs and failure-recovery bugs, not simple spawn bugs.

## Evidence summary

1. Codex local debug binary remains a known Windows trap.
   Source: root `.planning/ERRORS-AND-ATTEMPTS.xml`, entry `codex-local-debug-binary-dll-init-2026-04-21`.
   Current code path: [scripts/codex-trial.mjs](/C:/Users/benja/Documents/custom_portfolio/scripts/codex-trial.mjs) still prefers `tmp/openai-codex/codex-rs/target/debug/codex.exe` before global/PATH/pnpm fallback.

2. Runtime naming and wrapper entrypoints are split across two incompatible surfaces.
   Source of mismatch:
   - [vendor/get-anything-done/lib/runtime-launch.cjs](/C:/Users/benja/Documents/custom_portfolio/vendor/get-anything-done/lib/runtime-launch.cjs) uses `scripts/{codex,gemini,opencode}-trial.mjs`
   - [vendor/get-anything-done/lib/team/config.cjs](/C:/Users/benja/Documents/custom_portfolio/vendor/get-anything-done/lib/team/config.cjs) uses `node scripts/gad-opencode-trial.mjs -- run --format json`
   - [scripts/runtime-adapters/gemini-cli.mjs](/C:/Users/benja/Documents/custom_portfolio/scripts/runtime-adapters/gemini-cli.mjs), [codex-cli.mjs](/C:/Users/benja/Documents/custom_portfolio/scripts/runtime-adapters/codex-cli.mjs), and [opencode.mjs](/C:/Users/benja/Documents/custom_portfolio/scripts/runtime-adapters/opencode.mjs) still point at `gad-*` wrappers
   - [vendor/get-anything-done/lib/runtime-detect.cjs](/C:/Users/benja/Documents/custom_portfolio/vendor/get-anything-done/lib/runtime-detect.cjs) returns `codex` / `gemini`, while worker/runtime config mostly uses `codex-cli` / `gemini-cli`

3. Gemini wrapper contract drift already caused real worker failure.
   Source: root `.planning/ERRORS-AND-ATTEMPTS.xml`, entry `cross-runtime-self-heal-2026-05-04`, plus open entry `gemini-cli-internal-retry-hang-2026-05-03`.
   Current wrappers: [scripts/gad-gemini-trial.mjs](/C:/Users/benja/Documents/custom_portfolio/scripts/gad-gemini-trial.mjs) and [scripts/gemini-trial.mjs](/C:/Users/benja/Documents/custom_portfolio/scripts/gemini-trial.mjs).

4. Team recovery only reopens handoffs on explicit `rate_limited=true`.
   Current behavior:
   - [vendor/get-anything-done/lib/team/subprocess.cjs](/C:/Users/benja/Documents/custom_portfolio/vendor/get-anything-done/lib/team/subprocess.cjs) detects rate limits midstream
   - [vendor/get-anything-done/lib/team/worker-loop.cjs](/C:/Users/benja/Documents/custom_portfolio/vendor/get-anything-done/lib/team/worker-loop.cjs) only unclaims on the rate-limit path
   - non-rate-limit wrapper failures such as `bash: ... command not found` / exit `127` fall through to mailbox failure without reopening the claimed handoff

5. Dispatcher assignment ignores worker liveness.
   Current behavior: [vendor/get-anything-done/lib/team/dispatcher.cjs](/C:/Users/benja/Documents/custom_portfolio/vendor/get-anything-done/lib/team/dispatcher.cjs) selects targets from `listWorkerIds()` + mailbox depth without checking worker `status.state`, `pid`, or `pidAlive`.
   Related evidence: root `.planning/ERRORS-AND-ATTEMPTS.xml` entries around stale pid/worker state and restart hygiene.

## Top 5 hardening targets

### P0 - Target 1: Runtime naming and wrapper source-of-truth normalization

**Why first**

This is the root inconsistency behind multiple downstream failures. We currently have three overlapping notions of the same runtime surface:

- runtime ids: `codex` vs `codex-cli`, `gemini` vs `gemini-cli`
- launch wrappers: `scripts/*-trial.mjs`
- team/substrate wrappers: `scripts/gad-*-trial.mjs`

If this stays split, every fix must be landed twice and docs/tests continue to drift.

**Primary files**

- `vendor/get-anything-done/lib/runtime-launch.cjs`
- `vendor/get-anything-done/lib/runtime-detect.cjs`
- `vendor/get-anything-done/lib/agent-detect.cjs`
- `vendor/get-anything-done/lib/team/config.cjs`
- `scripts/runtime-adapters/{codex-cli,gemini-cli,opencode}.mjs`
- `references/runtime-resolution.md`

**Planned outcome**

- one canonical runtime id per runtime surface
- one canonical wrapper entrypoint per runtime
- explicit mapping only at boundaries where legacy aliases must still parse
- docs/tests/config all point at the same wrapper names

**Verification**

- `node bin/gad.cjs runtime launch --projectid global --force-runtime codex-cli --dry-run --json`
- `node bin/gad.cjs runtime select --projectid global --json`
- targeted tests for `runtime-detect`, `team-config`, and runtime adapter probes

### P0 - Target 2: Worker failure taxonomy and handoff reopening beyond rate limits

**Why second**

The current worker loop preserves queue health only for rate limits. Wrapper/process failures like exit `127`, missing binaries, bad CLI signatures, and shell bootstrap failures can strand handoffs in `claimed/`, which is worse than a visible failure because the queue stops self-healing.

**Primary files**

- `vendor/get-anything-done/lib/team/subprocess.cjs`
- `vendor/get-anything-done/lib/team/worker-loop.cjs`
- `vendor/get-anything-done/lib/team/rate-limit.cjs`
- `vendor/get-anything-done/lib/handoffs.cjs`

**Planned outcome**

- classify subprocess exits into:
  - rate-limit reopen
  - wrapper/environment reopen
  - true work failure
- add an explicit reopen policy for exit `127`, binary-not-found, shell-snapshot startup errors, and adapter-signature errors
- keep audit trail in `unclaim_history` with reason codes more specific than just `rate-limit`

**Verification**

- new targeted tests for exit `127` reopening
- regression coverage so mailbox failures do not leave the linked handoff claimed

### P1 - Target 3: Dispatcher liveness gating and stale-worker avoidance

**Why third**

Even with better reopening, the queue still degrades if the dispatcher keeps enqueueing work to stopped or stale workers. Today it picks by mailbox depth and runtime/lane affinity only.

**Primary files**

- `vendor/get-anything-done/lib/team/dispatcher.cjs`
- `vendor/get-anything-done/lib/team/status.cjs`
- `vendor/get-anything-done/lib/team/lock.cjs`

**Planned outcome**

- dispatcher excludes workers in `STOPPED` or without live pid
- stale status/pid state is treated as non-routable
- enqueue logs explain why a worker was skipped

**Verification**

- targeted dispatcher tests with fake stopped workers
- manual `gad team dispatch` proof that open handoffs prefer live/idle workers

### P1 - Target 4: Codex local debug binary quarantine and fallback policy

**Why fourth**

This is a narrower but recurring Windows reliability bug. The root cause is already known: `scripts/codex-trial.mjs` prefers a local debug build that can fail with `STATUS_DLL_INIT_FAILED`.

**Primary files**

- `scripts/codex-trial.mjs`
- `scripts/gad-codex-trial.mjs`
- related runtime-resolution docs

**Planned outcome**

- local debug binaries stop winning by default unless explicitly opted into
- broken local debug binaries fall through automatically to a healthy global/pinned path
- failure reporting tells the operator which candidate was skipped and why

**Verification**

- wrapper smoke with debug binary present but invalid
- proof that fallback path is chosen without manual renaming

### P1 - Target 5: Gemini/OpenCode wrapper contract hardening

**Why fifth**

Gemini and OpenCode have both shown contract drift:

- Gemini: wrong CLI argument shape and retry hang behavior
- OpenCode: docs/adapters/team config disagree about headless contract and wrapper naming

These do not need identical fixes, but they should be planned together because they come from the same wrapper contract gap.

**Primary files**

- `scripts/gad-gemini-trial.mjs`
- `scripts/gemini-trial.mjs`
- `scripts/gad-opencode-trial.mjs`
- `scripts/opencode-trial.mjs`
- `scripts/runtime-adapters/{gemini-cli,opencode}.mjs`
- `references/opencode-headless.md`

**Planned outcome**

- Gemini wrapper arguments match the real CLI signature, with retry behavior constrained enough for worker recovery
- OpenCode docs, team config, and adapter capability flags agree on whether the runtime is headless/json-capable in each surface
- runtime adapters describe the actual wrapper contracts in use

**Verification**

- wrapper `--help` / `--version` probes
- targeted team worker tests for Gemini wrapper failures and OpenCode command resolution

## Execution order

### Wave 1 - Canonicalization

1. Target 1: runtime naming + wrapper source-of-truth normalization

This should land first because every other task depends on consistent runtime ids and wrapper paths.

### Wave 2 - Queue safety

2. Target 2: worker failure taxonomy + reopen rules
3. Target 3: dispatcher liveness gating

These can be developed in parallel once Target 1 is stable, but should verify together because both affect handoff lifecycle.

### Wave 3 - Runtime-specific resilience

4. Target 4: Codex local debug fallback hardening
5. Target 5: Gemini/OpenCode wrapper contract hardening

These are runtime-specific follow-ups after the common contract is cleaned up.

## Non-goals

- No rebuild/install of `gad.exe` in this worker session
- No implementation in `bin/gad.cjs` runtime wiring during this handoff
- No broad runtime-substrate redesign
- No changes to planning state outside task registration and a one-line state log

## Suggested task decomposition

1. `75-06` Normalize runtime ids and wrapper entrypoints across launch, team, substrate, adapters, and docs.
2. `75-07` Reopen claimed handoffs on wrapper/environment/process failures that are recoverable but not rate-limit classified.
3. `75-08` Prevent dispatcher routing to stopped or stale workers.
4. `75-09` Harden Codex wrapper fallback so broken local debug binaries do not win by default.
5. `75-10` Align Gemini/OpenCode wrapper contracts, capability flags, and retry behavior with real CLI behavior.

## Verification strategy for the implementation phase

- Prefer targeted node tests over broad suite runs.
- Add regression tests before changing reopen/dispatch behavior.
- Smoke each runtime wrapper independently with `--help` or `--version` before using it in the worker loop.
- For handoff lifecycle changes, verify both filesystem state and task attribution state.
