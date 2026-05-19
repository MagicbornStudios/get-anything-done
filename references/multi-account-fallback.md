# Multi-account + multi-runtime fallback coverage audit

Phase 87 goal: "never stall on rate limit — rotate accounts or switch runtimes automatically."
Audit date: 2026-05-07. Auditor: sonnet-87-audit (claude-code).

---

## Currently shipped

### 1. Account registry — capture / list / rotate / status (`gad accounts`)

Source: `bin/commands/accounts.cjs` + `lib/team/accounts-registry.cjs`

| Subcommand | Effect |
|---|---|
| `gad accounts add <provider> --label <name>` | Captures current provider OAuth file into `~/.gad-credentials/` and writes to `.planning/team/runtime-accounts.json` |
| `gad accounts login <provider> --label <name>` | Runs provider login flow, then captures |
| `gad accounts list [--provider <p>]` | Lists all registered accounts with status, active flag, last_used_at |
| `gad accounts use <provider> --label <name>` | Copies stored credential back to canonical path; marks active in `runtime-account-state.json` |
| `gad accounts rotate <runtime> [--label <name>]` | Advances runtime to next usable account or forces a specific label |
| `gad accounts pause / resume <provider> --label <name>` | Sets account status (active / paused) |
| `gad accounts remove <provider> --label <name>` | Unregisters from team registry + global `~/.gad-credentials/registry.json` |

Providers supported: `codex`, `gemini`, `claude`, `opencode` (see `PROVIDERS` map in `accounts-registry.cjs`).
Credential types: OAuth file (codex, gemini, claude) or env-var (opencode).
Global store: `~/.gad-credentials/` — populated with real accounts for `codex` (5 accounts: primary, secondary, codex_1-4), `gemini` (1), `opencode` (env-var), `claude-code` (1).

Legacy compat: `scripts/gad-accounts.mjs` is a thin wrapper that forwards `capture` → `gad accounts add` (phase 110 bridge).

---

### 2. In-worker automatic account rotation on rate-limit

Source: `lib/team/worker-loop.cjs` (lines 51-97, 255-281) + `lib/team/rate-limit.cjs`

The worker inner retry loop (`for (;;)`) works as follows on a rate-limit signal:

1. `runSubprocess` returns `result.rate_limited = true`
2. `handleRateLimitedHandoff` is called:
   a. Tries `rotateRuntimeAccount` — advances to the next usable account for the same runtime
   b. If rotation succeeds: retries the same handoff under the new account (loop continues)
   c. If all accounts exhausted: optionally parks the runtime via `parkRuntime` (only when `GAD_ENABLE_RUNTIME_PARKING=1`), then calls `unclaimHandoff` with `reason: 'rate-limit'` so the handoff returns to `open/` for another worker/runtime to claim
3. Log event emitted: `runtime-account-rotated` or `runtime-rate-limit-on-call`

Rate-limit detection patterns (`RATE_LIMIT_PATTERNS` in `rate-limit.cjs`): covers codex "hit your usage limit / Upgrade to Pro", gemini "RESOURCE_EXHAUSTED / quota will reset / exhausted your capacity", generic 429 / "Too Many Requests / rate-limited".

Hard-cap distinction (`HARD_USAGE_CAP_PATTERNS`): "hit your usage limit / Upgrade to Pro / Plan limit reached / try again at" → 4-hour cooldown vs 15-minute default.

Per-handoff retry budget: `MAX_RATE_LIMIT_RETRIES = 3` rate-limit unclaims per runtime. Handoffs exhausted for ALL team runtimes are skipped by both worker self-claim and dispatcher (`isHandoffExhaustedForRuntimes`).

---

### 3. Cross-runtime fallback chain

Source: `lib/team/rate-limit.cjs` (`loadGlobalFallbacks`, `loadFallbackChain`, `nextAvailableRuntime`) + `.planning/team/runtime-fallbacks.json`

The file `.planning/team/runtime-fallbacks.json` defines the configured fallback order:

```json
{
  "codex-cli":  ["gemini-cli", "cursor-cli", "opencode"],
  "gemini-cli": ["codex-cli", "cursor-cli", "opencode"],
  "opencode":   ["gemini-cli", "codex-cli", "cursor-cli"],
  "claude-code":["codex-cli", "gemini-cli", "cursor-cli"]
}
```

When `GAD_ENABLE_RUNTIME_PARKING=1`, `nextAvailableRuntime` skips parked runtimes and walks the fallback chain. Handoff frontmatter can override the chain via `runtime_fallbacks: [...]`.

The dispatcher also reads `loadGlobalFallbacks` for `runtimeAffinityRank` scoring — workers whose runtime appears early in a handoff's fallback chain get higher priority.

---

### 4. Runtime health matrix — preflight before dispatch (`gad runtime check / matrix`)

Source: `lib/runtime-health/index.cjs` + `bin/commands/runtime/check.cjs` (phase 138)

Functions: `checkInstall`, `checkAuth`, `checkJsonContract`, `runFullPreflight`, `buildMatrixRows`
CLI: `gad runtime check [<runtime>]` — install + auth + JSON-contract probe per runtime
CLI: `gad runtime matrix --task-shape <shape>` — adds historical success-rate column + PREFERRED/OK/AVOID/BLOCKED recommendation per runtime

Success-rate data sourced from `.gad/traces/**/*.json` (runtime trace events). Requires `limit` runs per runtime before recommendations graduate from health-only to rate-weighted.

---

### 5. Rate-limit ETA prediction (`gad runtime budget`)

Source: `lib/runtime-budget/index.cjs` (phase 106) + `bin/commands/runtime/budget.cjs`

Functions:
- `aggregateWorkerTokens` — reads all worker `log.jsonl` files, extracts per-handoff token counts from codex-style `subproc-stderr` "tokens used\n<count>" events
- `predictNextRateLimit` — uses inter-event intervals from `runtime-rate-limit-on-call` log entries over last 24h to estimate ETA until next rate-limit
- `costPerHandoff` — token histogram bucketed by (runtime × context-tier × time-tier)
- `persistBudgetSnapshot` — appends snapshot to `.planning/.gad-log/token-budgets.jsonl`

Limitation: token extraction is codex-cli-specific (parses codex stderr format). Claude-code and gemini-cli do not emit the same pattern, so `totalTokens` is null for those runtimes.

---

### 6. Handoff-quality runtime-preference contract (phase 131)

Source: `lib/team/dispatcher.cjs` (`dispatchOnce`), `lib/agent-detect.cjs` (`isHandoffCompatible`, `runtimeAffinityRank`)

Dispatcher filters worker pool by `matchesLane` + `isHandoffCompatible(frontmatter, runtime)` before assigning. Workers with a runtime matching `handoff.frontmatter.runtime_preference` get lowest affinity rank (highest priority). Fallback runtimes from `runtime_fallbacks` frontmatter or global chain are also ranked.

---

### 7. Sweep handoffs / MCP on-demand dispatch (phase 164)

Source: `lib/mcp/` + dispatcher daemon; `gad handoffs sweep` surfaces via MCP tool call.
Effect: operator can trigger a dispatcher sweep on demand without waiting for the 10s poll interval.

---

## Gaps

### G1. Runtime parking disabled by default — RESOLVED (phase 110-01)

`parkingEnabled` now returns `true` by default (opt-OUT). Set `GAD_ENABLE_RUNTIME_PARKING=0` to disable.

Previously the env-var was opt-in (`=1`). As of phase 110-01, parking is on unless the operator explicitly disables it.

On dispatcher startup the daemon logs to stderr:
```
[gad-team] runtime parking: enabled
```
and a `parking-state` entry lands in `dispatcher.log.jsonl` so the state is visible in logs.

Env-var: `GAD_ENABLE_RUNTIME_PARKING=0` to disable, unset or any other value → enabled.

---

### G2. No cross-runtime runtime-switch at the worker level

When all accounts for a runtime are exhausted and parking is off (default), the worker requeues the handoff but cannot switch its OWN runtime mid-session. Runtime switch only happens if another worker with a different runtime picks up the requeued handoff. If there is only one worker runtime configured (common solo-worker setup), the handoff will bounce `MAX_RATE_LIMIT_RETRIES * n-accounts` times and then be permanently skipped.

Phase 87's original intent ("switch runtime automatically") is only partially achieved — it works via the multi-worker dispatcher model, not within a single worker. A single worker cannot self-reassign to a fallback runtime.

---

### G3. Token-budget ETA is codex-only

`predictNextRateLimit` is only useful when codex-cli workers are running (token-count extraction parses codex-specific stderr format). Gemini-CLI and Claude-Code workers produce `totalTokens: null`, so budget prediction is unavailable for those runtimes. Rate-limit ETA for gemini is based purely on event timestamps (no token-burn-rate dimension).

---

### G4. Cooldown recovery not surfaced in `gad team status` — RESOLVED (phase 110-01)

`gad team status` now includes a `COOLDOWN` column in the text table and a `cooldown_remaining_seconds` field in JSON output per worker.

- `--` means not parked.
- `<N>s` means the worker's runtime has `N` seconds remaining in its parking cooldown.
- Source: `lib/team/rate-limit.cjs::getCooldownRemainingMs(baseDir, runtime)` — reads `runtime-cooldown.json`, returns 0 if entry is expired or absent.
- JSON: `workers[n].cooldown_remaining_seconds` (integer, 0 = no cooldown).

---

### G5. No automated account-health polling — RESOLVED (phase 110-01)

`gad accounts poll` is now available.

- `gad accounts poll --once` — single pass: auto-flips `rate-limited` → `active` when `reset_at` < now; calls per-runtime probe stubs where they exist.
- `gad accounts poll --daemon [--interval-min N]` — hardened loop (in-flight guard, BELOW_NORMAL priority advisory, skip-if-no-changes); default 15-minute interval.
- `gad accounts poll --json` — JSON output `{ updated: N, statuses: [...] }`.
- Logs to `.planning/team/account-poller.log`.

Per-runtime quota probe functions (`pollCodex`, `pollGemini`, `pollClaude`, `pollOpencode`) are in `lib/team/account-poller.cjs`. All currently return `{ status: 'unknown', reason: 'no quota endpoint' }` because no provider exposes a usable quota REST endpoint from stored OAuth files. The stub pattern makes it easy to add probes when endpoints become available. The `reset_at` flip runs regardless.

When all accounts return `unknown`, poll reports `0 updated (all unknown — no quota endpoints available)` cleanly.

---

## Recommendation

**Close task 87-01 as audit-done. Do NOT flip phase 87 status without operator review.**

Phase 87's core deliverable — "never stall on rate limit" — is approximately 80% implemented:

- Account rotation within a runtime: fully shipped and wired into the worker loop
- Cross-runtime fallback: shipped via requeue + multi-worker dispatch; NOT within a single worker
- Runtime health preflight before dispatch: shipped (phase 138)
- Rate-limit ETA prediction: shipped but codex-only (phase 106)
- On-demand sweep: shipped (phase 164)
- Handoff runtime-preference contract: shipped (phase 131)

Gaps G1, G4, G5 are operator-ergonomics gaps (parking visibility, cooldown display, automated status sync). They do not block functionality but require human attention when hits occur.

Gap G2 is the principal architectural gap: single-worker deployments still stall if all accounts for their runtime exhaust. The fix is documented: either always run multiple workers (current best practice) or add per-worker runtime fallback logic so a worker can restart itself under a different runtime config.

Gap G3 is a monitoring gap only — rate-limit events still trigger account rotation; budget prediction is just less informative for non-codex runtimes.

**If operator wants a clean close**: register follow-on tasks for G1 (document + default GAD_ENABLE_RUNTIME_PARKING), G4 (surface cooldown in `gad team status`), G5 (auto-flip account status post-exhaustion). Then mark phase 87 done.

**If operator wants a strict close**: G2 (single-worker runtime-switch) needs a proper task before 87 can be marked fully delivered.

---

## Source cross-reference

| Capability | Source file | Phase |
|---|---|---|
| Account registry (capture/list/rotate) | `bin/commands/accounts.cjs`, `lib/team/accounts-registry.cjs` | 110 |
| In-worker account rotation | `lib/team/worker-loop.cjs`, `lib/team/rate-limit.cjs` | 110 |
| Cross-runtime fallback chain | `lib/team/rate-limit.cjs`, `.planning/team/runtime-fallbacks.json` | 110 |
| Runtime health matrix | `lib/runtime-health/index.cjs`, `bin/commands/runtime/check.cjs` | 138 |
| Rate-limit ETA + budget | `lib/runtime-budget/index.cjs`, `bin/commands/runtime/budget.cjs` | 106 |
| Handoff runtime-preference contract | `lib/team/dispatcher.cjs`, `lib/agent-detect.cjs` | 131 |
| Handoff-level per-runtime retry cap | `lib/team/rate-limit.cjs` `isHandoffExhaustedForRuntime` | 122 |
| On-demand sweep / MCP dispatch | `lib/mcp/`, `gad handoffs sweep` | 164 |
| Legacy bridge script | `scripts/gad-accounts.mjs` | pre-110 |
| Quota observation persistence | `lib/team/accounts-registry.cjs::recordAccountQuotaState` + `lib/team/worker-loop.cjs::persistAccountQuotaObservation` | 110-06 |

---

## Layer separation (phase 110-09 verification)

The substrate has **two distinct fallback layers** and 110-09 was the
task of confirming they are correctly composed:

### Layer 1 — Account rotation (per-runtime)

When a runtime invocation returns a rate-limit signal:

1. `handleRateLimitedHandoff` calls `persistAccountQuotaObservation`
   to write `status='rate-limited'`, `last_error`, `reset_at`, and
   `current_quota` onto the account record (110-06).
2. `rotateRuntimeAccount` advances to the next *usable* account for
   the same runtime. Paused / rate-limited accounts are skipped.
3. The handoff loop retries the same handoff under the new account.
4. After `MAX_RATE_LIMIT_RETRIES` (3) rotations on the same handoff,
   the handoff is `unclaim`ed with `reason: 'rate-limit'`.

This layer never changes the runtime — only the credential file
pointed at by `CODEX_HOME` / `GEMINI_CONFIG_DIR` / canonical paths.

### Layer 2 — Runtime fallback (per-handoff)

Once a handoff is unclaimed with `reason: 'rate-limit'`:

1. The handoff returns to `.planning/handoffs/open/`.
2. `unclaim_history` accumulates per-runtime rate-limit counts.
3. `sortHandoffsForPickup` (via `runtimeAffinityRank`) re-ranks open
   handoffs against the available worker pool. Workers whose runtime
   appears in the handoff's `runtime_fallbacks` (frontmatter override)
   or in `loadGlobalFallbacks` get higher pickup priority.
4. A different worker (likely a different runtime per the ranking
   above) self-claims and retries the handoff.
5. `isHandoffExhaustedForRuntime` tracks per-runtime caps so a handoff
   that bounced 3x off gemini-cli is still eligible for codex / etc.

This layer changes the runtime but inherits whatever active account
each runtime has in its registry.

### Why the two layers compose correctly

- Layer 1 fires inside a single worker process. Layer 2 fires across
  worker processes via the open-handoff queue.
- Layer 1 rotation is invisible to Layer 2: a handoff that succeeds
  after rotating accounts within `codex-cli` never reaches Layer 2.
- Layer 2 only engages when Layer 1 has exhausted all accounts AND
  unclaimed the handoff. At that point Layer 2 picks a *different*
  runtime, which has its OWN account pool that Layer 1 will iterate
  through on the new worker.
- `MAX_RATE_LIMIT_RETRIES` is per-runtime in Layer 2 — so the same
  handoff can legitimately bounce `n_runtimes * MAX_RATE_LIMIT_RETRIES`
  times before being permanently blocked. That bound is intentional.

The composed behavior delivers phase 87's contract: a handoff never
stalls on a single rate-limit; it walks the union of (accounts per
runtime) × (runtimes in fallback chain) before being marked
permanently un-dispatchable.

### Confirmation of wiring (2026-05-19)

- `lib/team/worker-loop.cjs` imports both `rotateRuntimeAccount` (Layer 1)
  and `loadGlobalFallbacks` (Layer 2 inputs).
- `lib/team/dispatcher.cjs` reads `loadGlobalFallbacks` for
  `runtimeAffinityRank` scoring.
- `bin/commands/team/dispatch.cjs` and `bin/commands/handoffs.cjs`
  both use `isHandoffExhaustedForRuntimes` to filter open handoffs.
- `tests/team-worker-rate-limit-rotation.test.cjs` exercises Layer 1
  end-to-end (`resolves active account env and rotates to the next
  configured account` + `logs runtime-account-rotated before requeue
  when accounts are exhausted`).
- `tests/handoffs-quality-gate.test.cjs` covers Layer 2 routing.

No additional wiring is required to satisfy 110-09. The two layers are
already composed correctly via the existing entrypoints.
