---
id: h-2026-05-08T04-39-27-get-anything-done-75
projectid: get-anything-done
phase: 75
task_id: 75-11
created_at: 2026-05-08T04:39:27.966Z
created_by: unknown
claimed_by: unknown
claimed_at: 2026-05-08T08:41:04.432Z
completed_at: 2026-05-08T08:41:06.221Z
priority: high
estimated_context: prescribed
risk: safe
time: deep
surface: local
runtime_preference: codex-cli
---
# Runtime error taxonomy (GLOBAL-D-313 / GAD-T-75-11)

Implement typed runtime error classification across all adapters + worker loop. Today every runtime failure becomes generic `rate-limit-detected-midstream` with `cooldown_until=null`, causing tight reclaim loops. Observed: handoff `h-2026-05-05T05-10-50-global-130` bounced 8x in 30 minutes off worker w2 (gemini-cli) — w2 hit a real quota error AND a Windows PTY error, both classified identically.

Lane note: claude-code is DENIED `lib/runtime-*` and `lib/team/rate-limit.cjs|subprocess.cjs|worker-loop.cjs`. This handoff is for codex-cli to execute.

## Files to touch (all denied for claude-code)

| Path | What changes |
|---|---|
| `vendor/get-anything-done/lib/team/rate-limit.cjs` | Replace single-bucket `isRateLimited()` with `classifyRuntimeError(stderr, exitCode, runtimeId)` returning `{ class, cooldown_ms?, cooldown_until?, reason_text }`. Keep `isRateLimited()` as a thin wrapper that returns `class === 'quota_soft' \|\| class === 'quota_hard_cap'` for back-compat. |
| `vendor/get-anything-done/lib/team/subprocess.cjs:95-131` | `terminateForRateLimit()` becomes `terminateForRuntimeFailure(classification)`. Log `kind: 'runtime-failure-classified'` with full classification object instead of bare `kind: 'rate-limit-detected-midstream'`. Keep emitting the legacy `kind` for one release for back-compat with log readers. |
| `vendor/get-anything-done/lib/team/worker-loop.cjs:76-90, 169-299` | Per-class dispatch: see "Dispatcher behavior per class" below. Add `parking_enabled` to the worker status doc so operators can see it without grepping logs. |
| `vendor/get-anything-done/scripts/runtime-substrate-core.mjs:435-449` | `normalizeErrorCode()` already returns enum-shaped strings — extend with new classes. Wire `classifyRuntimeError` so substrate path and worker path agree. |
| `vendor/get-anything-done/tests/team-subprocess-rate-limit.test.cjs` | Add fixtures for S1–S6 (real stderr samples below). Single existing fixture (`'RESOURCE_EXHAUSTED: quota will reset later\n'`) is too clean — does not represent real gemini-cli stderr. |

## Taxonomy (8 classes)

| class | Trigger pattern (examples) | Cooldown extractable? | Retryable? |
|---|---|---|---|
| `quota_soft` | `/exhausted your capacity/i` + `/quota will reset after (\d+h\d+m\d+s)/i` | YES — parse the duration | After cooldown |
| `quota_hard_cap` | `/Plan limit reached/i`, `/Upgrade to Pro/i`, `/usage limit/i` | NO (4h jitter default) | After hours/billing reset |
| `auth_failed` | `/AUTH(_| )?(EXPIRED\|MISSING\|INVALID)/i`, `/401 Unauthorized/i`, `/Invalid API key/i` | N/A | NO — surface to operator immediately |
| `network_error` | `/ECONNRESET\|ETIMEDOUT\|ENOTFOUND\|EAI_AGAIN/`, `/getaddrinfo/i` | N/A | YES exp backoff max 3 |
| `malformed_argv` | exit code 2 + `/Unknown (option\|argument)/i`, `/missing required/i` | N/A | NO — adapter bug, surface |
| `runtime_crash` | `/AttachConsole failed/i` (Windows PTY), `/conpty/i`, segfault, exit 139, exit < 0 | N/A | NO — surface w/ stderr tail |
| `output_unparseable` | exit 0 but JSON.parse fails on stdout, or `[object Object]` in stderr w/o other matches | N/A | NO — adapter bug, surface |
| `unknown` | default — does NOT auto-classify as rate-limit | N/A | NO — surface w/ stderr tail |

## Cooldown extraction

Today: `rate-limit.cjs:418` returns binary 4h or 15m, ignoring the actual reset time printed in stderr.

Real samples (from `.planning/team/workers/w2/log.jsonl`):
- `"Your quota will reset after 13h55m22s"` → parse to 50122 seconds
- `"try again at 14:30"` → parse local-tz timestamp
- `"Retry-After: 300"` (HTTP header in JSON body) → 300 seconds

Add `parseCooldown(text)` returning ms or null. Set `cooldown_until = Date.now() + ms`.

## Dispatcher behavior per class

| class | Worker action | Handoff action |
|---|---|---|
| `quota_soft` | park runtime until `cooldown_until + 60s jitter` | re-route to next runtime in fallback chain |
| `quota_hard_cap` | mark account paused via `gad accounts pause`; rotate via `gad accounts rotate` | requeue, do NOT mark exhausted on handoff |
| `auth_failed` | stop worker, emit `kind: 'auth-blocked'`, do NOT retry | unclaim handoff with reason `auth-failed-{runtime}`, do NOT route to other accounts of same provider |
| `network_error` | exp backoff 5s → 30s → 120s, max 3 retries, then surface | reclaim from same worker after backoff |
| `malformed_argv` | stop worker, emit `kind: 'adapter-bug'`, surface stderr | unclaim with reason `adapter-bug`, refuse re-route |
| `runtime_crash` | log full stderr tail (last 50 lines), restart worker once, then stop if crashes again | requeue with `crash_count++` in unclaim_history |
| `output_unparseable` | stop worker, emit `kind: 'adapter-bug'`, surface stdout+stderr | unclaim with reason `output-unparseable` |
| `unknown` | log full stderr tail, do NOT retry, do NOT route to fallback | unclaim with reason `unknown-failure` for human triage |

## Bug to fix alongside (parking_enabled)

`rate-limit.cjs:399-401` reads `process.env.GAD_ENABLE_RUNTIME_PARKING` inline at every call. The w2 log shows `parking_enabled: false` — so somewhere the env var is being set to `'0'`. Either:
- Find where `GAD_ENABLE_RUNTIME_PARKING=0` is set in the spawn chain and remove it (it's now load-bearing for the new taxonomy).
- OR make parking always-on for `quota_soft` and `quota_hard_cap` regardless of env var (treat the env var as "disable for testing only"; document it).

Proposed: keep env var but invert default — parking ON unless `GAD_DISABLE_RUNTIME_PARKING=1`. Also write `parking_enabled` into worker status.json so it's visible in `gad team status` without grepping logs.

## Real stderr samples (S1–S6) — use as test fixtures

Read full text from `.planning/team/workers/w2/log.jsonl` (lines around the existing `rate-limit-detected-midstream` events).

| # | Class | Verbatim fragment |
|---|---|---|
| S1 | `quota_soft` | `"TerminalQuotaError: You have exhausted your capacity on this model. Your quota will reset after 13h55m22s."` |
| S2 | `quota_soft` | `"Attempt 1 failed with status 429. Retrying with backoff... _GaxiosError: [{ \"error\": { \"code\": 429, ... \"status\": \"RESOURCE_EXHAUSTED\", ... \"reason\": \"MODEL_CAPACITY_EXHAUSTED\" } }]"` |
| S3 | `quota_soft` (model-specific) | `"No capacity available for model gemini-3-flash-preview on the server"` |
| S4 | `output_unparseable` (NOT quota) | `"An unexpected critical error occurred:[object Object]"` — currently mis-classified as quota because it shares stderr buffer with S1 |
| S5 | `quota_soft` | `"\"reason\": \"rateLimitExceeded\""` inside Gaxios JSON body |
| S6 | `runtime_crash` (Windows PTY, NOT quota) | `"Error: AttachConsole failed at conpty_console_list_agent.js:11"` — currently classified as TOOL_FAILURE / unknown |

## Acceptance gate

- [ ] `lib/team/rate-limit.cjs` exports `classifyRuntimeError(stderr, exitCode, runtimeId)` returning the typed object.
- [ ] All 8 classes have at least one regex fixture in `tests/team-subprocess-rate-limit.test.cjs`.
- [ ] S4 (`[object Object]`) test asserts `class === 'output_unparseable'`, NOT `quota_*`.
- [ ] S6 (`AttachConsole failed`) test asserts `class === 'runtime_crash'`, NOT `quota_*` or `unknown`.
- [ ] S1 test asserts `cooldown_ms` parsed to ~50122000 (±60s tolerance).
- [ ] `worker-loop.cjs` parks runtime on `quota_soft` even when `GAD_ENABLE_RUNTIME_PARKING` is unset.
- [ ] Worker status.json includes `parking_enabled: true|false` field.
- [ ] `auth_failed` classification surfaces to STATE log + does NOT trigger account rotation.
- [ ] `gad team status --json` reflects new classification fields per worker.
- [ ] Existing `kind: 'rate-limit-detected-midstream'` log entries continue to be emitted alongside new `kind: 'runtime-failure-classified'` for one release (back-compat for log readers).
- [ ] Stamp task `GAD-T-75-11` with `--skill runtime-error-taxonomy` on completion.

## References

- Decision: `gad decisions show GLOBAL-D-313 --projectid global`
- Companion decision: `gad decisions show GLOBAL-D-312 --projectid global` (8-layer arch — adapter normalization is layer 3)
- Companion decision: `gad decisions show GLOBAL-D-314 --projectid global` (snapshot health rollup — already shipped, surfaces the parking_enabled gap)
- Trigger handoff: `.planning/handoffs/open/h-2026-05-05T05-10-50-global-130.md` (8x bounce log)
- Subagent map: see this turn's chat history for full file:line inventory of current adapter code (was used to write this handoff).