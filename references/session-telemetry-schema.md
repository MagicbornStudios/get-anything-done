# Session telemetry schema (v1)

**Phase:** 89 — session telemetry
**Task:** 89-01
**Decisions:** GLOBAL-D-291 (Skill Entropy formal name), gad-145, gad-220, gad-222 (pressure formula)
**Status:** schema frozen v1; adapters in 89-02..89-05 implement against this doc.

---

## Purpose

The session telemetry stream is the **whiteboard** — ephemeral, decomposition-focused
records of how a runtime worked through an intent. Distinct from the **durable wall**
(`.planning/tasks/*.json`, `.planning/DECISIONS.xml`, handoffs/, state log) and from the
**call trace** (`.planning/.gad-log/*.jsonl`, `.planning/.trace-events.jsonl`).

Three streams, three jobs:

| Stream | File(s) | Granularity | Question it answers |
|---|---|---|---|
| Durable wall | `.planning/{tasks,DECISIONS.xml,handoffs,STATE.xml}` | Per-decision / per-task | What is committed reality? |
| Call trace | `.planning/.gad-log/*.jsonl`, `.planning/.trace-events.jsonl` | Per-tool-call | What CLI/tool calls fired? |
| **Session whiteboard** | **`.planning/.sessions/<id>/events.jsonl`** | **Per-step + per-decomposition** | **How did the runtime decompose the work, and where did pressure land?** |

Skill Entropy (v2, task 89-06) reads the whiteboard. Pressure analysis reads the wall + whiteboard.
The call trace is consulted only when whiteboard signals require source-of-truth tool detail.

## Storage layout

```
.planning/.sessions/<session-id>/
  events.jsonl          # append-only, one JSON object per line
  meta.json             # optional summary (written on session-end)
```

`<session-id>` format: `s-YYYYMMDD-<short-uuid8>` (e.g. `s-20260502-a1b2c3d4`).

**Default = local-only.** `.planning/.sessions/` is gitignored. Preserve-on-demand path
(committed) is `.planning/sessions/preserved/<id>/` — promoted by 89-07's preserve flow.

## File format

JSONL (one JSON object per line, no trailing comma, no envelope object). Append-only.
Reader treats malformed lines as warnings, not fatal — degraded sessions still parse the
events that did land cleanly.

## Common envelope (every event)

| Field | Type | Required | Notes |
|---|---|---|---|
| `ts` | ISO-8601 string with ms (`2026-05-02T20:30:00.000Z`) | yes | Wall-clock UTC |
| `kind` | enum (see kinds below) | yes | One of 8 kinds |
| `session_id` | `s-YYYYMMDD-<uuid8>` | yes | Stable per session |
| `schema_version` | integer | yes | `1` for this doc |

**Why per-event `schema_version` instead of a file-header line?** JSONL is line-independent.
A consumer that tails / streams / shards the file must know how to parse each line in
isolation. Header lines force special-casing the first line and break tooling that grep+jq's
the file. Cost is ~20 bytes/event; benefit is every line self-describes.

## Event kinds (8 total)

### 1. `session-start` — opened a new whiteboard

| Field | Type | Required | Notes |
|---|---|---|---|
| `runtime` | string | yes | `claude-code` / `codex-cli` / `cursor` / `gemini-cli` / `opencode` |
| `projectid` | string | yes | Lowercase, e.g. `global` |
| `intent` | string | yes | One-line goal — what the user / handoff asked for |
| `parent_session_id` | string\|null | no | Set when this is a spawned subagent session |
| `model_profile` | string\|null | no | If known (`balanced`, `quality`, …) |
| `agent_id` | string\|null | no | If runtime exposes one (e.g. claude `agent_id`) |
| `claimed_handoff` | string\|null | no | Handoff id if session opened to claim a handoff |

### 2. `session-end` — closed the whiteboard

| Field | Type | Required | Notes |
|---|---|---|---|
| `outcome` | enum: `completed` \| `paused` \| `failed` \| `compacted` | yes | `compacted` = auto-compact mid-session triggered close |
| `total_steps` | integer | yes | Count of distinct `step_id`s seen |
| `total_retries` | integer | yes | Sum of `step-end.retries` |
| `durable_artifacts` | string[] | no | Task stamps, decision ids, handoff completes attributed to session |
| `auto_compact_count` | integer | no | Number of auto-compacts during session |

### 3. `step-start` — opened a unit of work

| Field | Type | Required | Notes |
|---|---|---|---|
| `step_id` | string `st-<N>` | yes | Monotonic per session, starting at `st-1` |
| `label` | string | yes | Short imperative (≤80 chars). E.g. `"Read apps/platform/lib/sites-data.ts"` |
| `parent_step` | string\|null | yes | `null` = top-level step under session root |

### 4. `step-end` — closed a unit of work

| Field | Type | Required | Notes |
|---|---|---|---|
| `step_id` | string | yes | Must match an open `step-start.step_id` |
| `outcome` | enum: `ok` \| `retry` \| `error` \| `abandoned` | yes | `retry` = step ended-and-restarted internally; same step_id continues |
| `retries` | integer | yes | Count of internal retries inside this step (≥0) |
| `duration_ms` | integer | yes | Wall-clock ms from step-start to step-end |

### 5. `tool-call` — a single tool invocation inside a step

| Field | Type | Required | Notes |
|---|---|---|---|
| `step_id` | string | yes | Open step this call belongs to |
| `tool` | string | yes | Tool name. Examples: `Read`, `Edit`, `Bash`, `Write`, `Grep`, `Glob`, `Agent`, `WebFetch`, `WebSearch` |
| `target` | string | yes | File path OR ≤120-char command summary — **not** file contents, **not** stdout |
| `ok` | boolean | yes | Did the tool return success? |
| `duration_ms` | integer | yes | |
| `output_excerpt` | string | no | **OPT-IN.** ≤500-char tail. Off by default; enable with `GAD_SESSION_TRACE_VERBOSE=1`. Never includes secrets — adapters scrub `.env`, `Authorization:`, `Bearer`, `sk-` prefixes before writing. |

### 6. `decomposition` — explicit plan-of-work expansion

Fired when a runtime breaks a parent step into a list of children up-front (e.g. claude
emitting "I'll do A, then B, then C" at the start of a TaskCreate batch). Optional but
load-bearing for Skill Entropy v2 — repeated identical decompositions on the same task
class are the entropy-collapse signal that names a candidate skill.

| Field | Type | Required | Notes |
|---|---|---|---|
| `parent_step` | string\|null | yes | `null` = decomposition at session root |
| `children` | string[] | yes | step_ids the parent will spawn (≥1, declared up-front) |

### 7. `pressure-event` — friction surfaced inside a step

Mirrors entries that feed the pressure formula (`vendor/get-anything-done/references/pressure-formula.md`).
Adapters emit these when retry / hook-block / file-modified / rate-limit / etc. happens.

| Field | Type | Required | Notes |
|---|---|---|---|
| `step_id` | string | yes | The step under pressure |
| `category` | enum (see below) | yes | |
| `weight` | integer | yes | Severity 1–5; higher = more pressure |
| `context` | string | yes | ≤200-char human-readable cause |

**`category` enum:**

| Value | Meaning |
|---|---|
| `retry` | Same operation repeated after non-fatal failure |
| `file-modified` | Edit blocked because file changed since last Read |
| `hook-block` | PreToolUse hook denied a tool call |
| `tool-error` | Tool returned non-`ok` |
| `rate-limit` | Runtime API rate-limited |
| `deviation` | Plan vs. execution diverged (e.g. step abandoned, scope grew) |
| `recovery` | Successfully recovered from prior pressure-event in same step |
| `ratelimit-rotation` | Operator rotated accounts / runtime to bypass rate-limit |

### 8. `attribution-link` — bridge a whiteboard step to a durable artifact

Fired by adapters whenever a step lands a durable change (task stamp, decision add,
handoff complete, state log entry, note add). Provides the join key for "which step earned
this task done?" — load-bearing for skill candidate detection (89-06).

| Field | Type | Required | Notes |
|---|---|---|---|
| `step_id` | string | yes | The step that produced the artifact |
| `artifact_kind` | enum: `task-stamp` \| `decision-add` \| `handoff-complete` \| `state-log` \| `note-add` | yes | |
| `artifact_id` | string | yes | Canonical id. E.g. `GLOBAL-T-89-01`, `GLOBAL-D-291`, `h-2026-05-02T20-38-04-global-89` |
| `agent` | string | yes | Agent identity that landed it (matches `gad tasks stamp --agent <agent>`) |

## Validation rules

1. Every event MUST carry the common envelope (`ts`, `kind`, `session_id`, `schema_version`).
2. `session_id` MUST match `^s-\d{8}-[a-f0-9]{8}$`.
3. Per session, the FIRST event MUST be `kind=session-start`. The LAST event MUST be `kind=session-end` (if session closed cleanly; mid-session crashes naturally lack it — readers tolerate).
4. Every `step-end.step_id` MUST refer to a previously-emitted `step-start.step_id` in the same session.
5. Every `tool-call.step_id` MUST refer to an open `step-start` (no `step-end` yet).
6. `decomposition.children` step_ids MUST appear as `step-start.step_id` events later in the file (forward reference allowed; consumer pass 2).
7. `pressure-event.weight` ∈ [1, 5]. Out-of-range MAY be clamped by the consumer.
8. `attribution-link.artifact_id` MUST be a registered id (consumer cross-checks against the durable wall during analysis; not a hard parse error).

## Privacy / scope

- `tool-call.target` is a path or command summary. **Never file contents.** **Never stdout/stderr.**
- `output_excerpt` is opt-in via `GAD_SESSION_TRACE_VERBOSE=1`. Adapters MUST scrub:
  - `.env`-style lines (`KEY=value` with KEY matching `*_KEY|*_TOKEN|*_SECRET|PASSWORD|API_KEY|GITHUB_TOKEN`)
  - HTTP `Authorization:` / `Bearer ` headers
  - Anthropic / OpenAI key prefixes (`sk-ant-`, `sk-`, `cl-`)
  - GitHub PATs (`ghp_`, `github_pat_`)
- No environment variables, no shell history, no clipboard, no `gad config show` output (which may include tokens).
- Consumers SHOULD treat `events.jsonl` as advisory — anything sensitive should never have landed there in the first place; if it did, the file is gitignored.

## Versioning

- `schema_version: 1` is this doc.
- Breaking changes (rename a field, change an enum value, remove a kind) bump to `schema_version: 2` and ship a migration note in this doc + adapter compatibility window.
- Additive changes (new optional field, new enum value at the END of an enum, new event kind) DO NOT bump version — readers MUST tolerate unknown optional fields and unknown event kinds (skip + warn, never fatal).

## Sample events.jsonl

A 10-event cross-section covering all 8 kinds. (Real session starts at `step-start st-1` and is several hundred events long.)

```jsonl
{"ts":"2026-05-02T20:30:00.000Z","kind":"session-start","session_id":"s-20260502-a1b2c3d4","schema_version":1,"runtime":"claude-code","projectid":"global","intent":"Land 89-01 session telemetry schema","claimed_handoff":"h-2026-05-02T20-38-04-global-89"}
{"ts":"2026-05-02T20:30:01.012Z","kind":"decomposition","session_id":"s-20260502-a1b2c3d4","schema_version":1,"parent_step":null,"children":["st-1","st-2","st-3","st-4"]}
{"ts":"2026-05-02T20:30:01.500Z","kind":"step-start","session_id":"s-20260502-a1b2c3d4","schema_version":1,"step_id":"st-1","label":"Read existing trace + pressure-formula references","parent_step":null}
{"ts":"2026-05-02T20:30:01.890Z","kind":"tool-call","session_id":"s-20260502-a1b2c3d4","schema_version":1,"step_id":"st-1","tool":"Read","target":"vendor/get-anything-done/references/pressure-formula.md","ok":true,"duration_ms":42}
{"ts":"2026-05-02T20:30:03.220Z","kind":"step-end","session_id":"s-20260502-a1b2c3d4","schema_version":1,"step_id":"st-1","outcome":"ok","retries":0,"duration_ms":1720}
{"ts":"2026-05-02T20:30:08.110Z","kind":"step-start","session_id":"s-20260502-a1b2c3d4","schema_version":1,"step_id":"st-2","label":"Write schema doc","parent_step":null}
{"ts":"2026-05-02T20:30:14.330Z","kind":"pressure-event","session_id":"s-20260502-a1b2c3d4","schema_version":1,"step_id":"st-2","category":"file-modified","weight":2,"context":"Edit failed; re-Read forced because parallel worker touched .gitignore"}
{"ts":"2026-05-02T20:30:21.870Z","kind":"step-end","session_id":"s-20260502-a1b2c3d4","schema_version":1,"step_id":"st-2","outcome":"ok","retries":1,"duration_ms":13760}
{"ts":"2026-05-02T20:30:22.110Z","kind":"attribution-link","session_id":"s-20260502-a1b2c3d4","schema_version":1,"step_id":"st-2","artifact_kind":"task-stamp","artifact_id":"GLOBAL-T-89-01","agent":"claude-code"}
{"ts":"2026-05-02T20:30:24.500Z","kind":"session-end","session_id":"s-20260502-a1b2c3d4","schema_version":1,"outcome":"completed","total_steps":4,"total_retries":1,"durable_artifacts":["GLOBAL-T-89-01"],"auto_compact_count":0}
```

## Skill Entropy v2 hooks (89-06 forward-reference)

The whiteboard captures the two signals v2 entropy needs:

1. **Decomposition diversity** — across N sessions tagged with the same task-class label, count distinct decomposition shapes. Identical shapes + zero retries = entropy collapse = skill candidate.
2. **Step-failure distribution** — per task-class, distribution of `step-end.outcome` and `pressure-event.category`. Concentrated distribution = a few well-known failure modes (skill is forming). Flat / scattered = no skill yet.

Skill Entropy v2 calc reads `.planning/.sessions/*/events.jsonl` filtered by `attribution-link.artifact_id` task-class, computes the two distributions, and returns `H_skill ∈ [0, log_2 N]` per task-class. Schema-side: keep `step-start.label` stable enough across sessions that task-class labels can be derived from labels with simple normalization (lowercase, strip paths). 89-06 documents the normalization.

## Adapter contracts (89-02..89-05 forward-reference)

Each runtime adapter MUST:

1. Open `events.jsonl` on session start; emit `session-start` synchronously before any other event.
2. Wrap every tool invocation: emit `step-start` if no open step, then `tool-call`, then `step-end` (if step closes).
3. Emit `pressure-event` on retry / hook-block / file-modified / tool-error.
4. Emit `attribution-link` on every `gad tasks stamp ... done` / `gad decisions add` / `gad handoffs complete` / `gad state log` / `gad note add` — adapter watches `gad` invocations.
5. Emit `session-end` on graceful close (auto-compact, user end-of-session, runtime exit).
6. Tolerate write failures non-fatally — log to stderr, continue session. Never crash the runtime over telemetry I/O.
7. Append-only. Never rewrite `events.jsonl` mid-session.

## Cross-references

- Pressure formula: `vendor/get-anything-done/references/pressure-formula.md`
- Skill Entropy decision: `gad decisions show 291` (alias `GLOBAL-D-291`)
- Phase 89 task chain: `.planning/tasks/89-{01..07}.json`
- JSON Schema validator: `vendor/get-anything-done/schemas/session-event.schema.json`
- Existing call trace: `.planning/.gad-log/*.jsonl`, `.planning/.trace-events.jsonl`
