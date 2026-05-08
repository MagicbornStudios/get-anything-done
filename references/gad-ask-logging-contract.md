# `gad ask` logging contract — what every invocation must log for SLM training

Standing rule (operator 2026-05-08): every `gad ask <kind>` invocation
MUST emit a structured trace event so the SFT corpus picks it up
automatically. No more "we asked but didn't capture the prompt or the
answer." Training data quality depends on the round-trip being durable.

## The contract — what a `gad ask <kind>` call must produce

Every call writes ONE line to `.planning/.trace-events.jsonl` with this
shape:

```json
{
  "kind": "ask",
  "ask_kind": "byok" | "todo" | "decision" | "text",
  "ts_started": "<ISO>",
  "ts_submitted": "<ISO>",
  "ts_completed": "<ISO>",
  "projectid": "<id>",
  "agent_id": "<who-asked>",
  "runtime": "<runtime-id>",
  "prompt": {
    "title": "<the question shown to operator>",
    "context": "<why-this-was-asked, optional>",
    "expected_shape": "<schema description: 'string' | 'enum:a,b,c' | 'object:{...}'>",
    "default_value": "<optional default>",
    "tags": ["..."]
  },
  "response": {
    "submitted": true | false,
    "value_redacted": "<if ask_kind==byok: SHA256 fingerprint, never the value>",
    "value_length": "<chars; for plaintext kinds>",
    "decision": "approve|reject|null",
    "note": "<short text answer or rationale>"
  },
  "outcome": {
    "ok": true | false,
    "side_effects": ["wrote .gad/secrets/<id>.enc v3", "appended .planning/todos/...", "..."],
    "error": "<message if !ok>"
  },
  "duration_ms": <integer>
}
```

## Why this exact shape

- **prompt.expected_shape** is the LLM-trainable target. SLMs learn:
  "when a question shaped like this is asked, the response shape is X."
- **response.value_redacted** for BYOK: never log the secret. Log a
  fingerprint (SHA256 first 16 chars) so an SLM can correlate but not
  recover.
- **outcome.side_effects** is the durable evidence — auditable, replayable.
- **duration_ms** is a pressure-system signal: long ask round-trips
  indicate operator friction (entropy producer, phase 88).

## Definitive `gad ask <kind>` invocations

These are the four canonical kinds. Any agent calling `gad ask` must
specify `--kind` AND the prompt fields so the log entry is complete.

### `gad ask byok` — capture an API key

```sh
gad ask byok \
  --projectid global \
  --provider anthropic \
  --key-name ANTHROPIC_API_KEY \
  --title "Anthropic API key for Kael chat substrate" \
  --context "Kael needs this to call claude-sonnet-4-6 from /kael route" \
  --tags chat,kael,production
```

Expected `response`:
```json
{ "submitted": true, "value_redacted": "sha256:abcd1234...", "value_length": null, "decision": null, "note": null }
```

Side effects:
- `.gad/secrets/global.enc` updated (new version)
- `.gad/secrets/global.audit.jsonl` appended

### `gad ask todo` — capture an operator-only todo

```sh
gad ask todo \
  --projectid global \
  --owner operator \
  --title "File company entity (LLC) for cloud startup credits" \
  --tags funding,entity,blocking \
  --context "AWS/Azure/GCP all gate on legal entity"
```

Expected `response`:
```json
{ "submitted": true, "value_redacted": null, "value_length": 247, "decision": null, "note": "<body markdown>" }
```

Side effects:
- `.planning/todos/<YYYY-MM-DD>-file-company-entity-...md` written

### `gad ask decision` — capture an approve/reject with rationale

```sh
gad ask decision \
  --projectid global \
  --title "Use Supabase pg_dump (BYOK) or Vercel Postgres backup for phase 100-03?" \
  --options "supabase-byok,vercel-native" \
  --context "Customer's data lives in their Supabase; BYOK keeps platform out of data path" \
  --tags 100-03,customer-export,architecture
```

Expected `response`:
```json
{ "submitted": true, "decision": "approve", "note": "supabase-byok — preserves data sovereignty" }
```

Side effects:
- `.planning/DECISIONS.xml` entry appended (new GLOBAL-D-<n>)

### `gad ask text` — capture a free-text answer

```sh
gad ask text \
  --projectid global \
  --title "What's the Modal credits boilerplate-email subject line?" \
  --context "Drafting founders@modal.com outreach for $50 credits"
```

Expected `response`:
```json
{ "submitted": true, "value_redacted": null, "value_length": 89, "note": "<answer>" }
```

Side effects:
- `.planning/notes/<YYYY-MM-DD>-<slug>.md` appended (or returned to in-process caller)

## Discipline rule for agents

When you (Claude / Codex / Gemini / Opencode / SLM) decide to ask the
operator something via `gad ask`:

1. **Pick the right kind** — byok / todo / decision / text
2. **Always pass --title + --context + --tags** — these are mandatory
   for the trace event to have training value. Don't ask without context.
3. **Always pass --expected-shape** when ambiguous — e.g.
   `--expected-shape "enum:supabase-byok,vercel-native"`
4. **Don't ask in the middle of a stream** — the operator-facing form
   blocks until submitted; if you're streaming a tool call back to the
   chat, finish the stream then ask.
5. **Treat the response as durable** — don't re-ask the same question
   in the same session. Read `.planning/.trace-events.jsonl` first to
   see if this prompt was already answered. If yes, reuse the answer.

## Training data emission

The phase 153 SFT export pipeline (`gad provenance sft-export`) joins:

- `.planning/.trace-events.jsonl` (CLI traces — every `gad ask` lands here)
- `.planning/transcripts/<date>/<thread>.jsonl` (Kael chat — phase 169)
- `.planning/team/workers/<id>/log.jsonl` (worker logs)

→ emits `<outDir>/<runtime>/ask-<kind>/<date>.jsonl` with the SFT tuple
shape:

```json
{
  "system_prompt": "You operate inside the GAD framework. When you need information from the operator, use gad ask <kind>.",
  "user_prompt": "<the title + context that was sent to the operator form>",
  "expected_response_shape": "<from prompt.expected_shape>",
  "tool_call": { "name": "ask_<kind>", "args": {...} },
  "tool_result": { "submitted": true, "...": "..." },
  "meta": {
    "label": "good|mid|bad",
    "quality_reason": "...",
    "task_type": "ask",
    "ask_kind": "byok|todo|decision|text",
    "duration_ms": ...,
    "value_redacted_for_secrets": true | false
  }
}
```

This is how our SLMs learn to call `gad ask` themselves — they see
millions of `prompt → ask → tool_result` round-trips with quality
labels and learn the patterns of WHEN to ask and WHAT shape the
response takes.

## Singleton + startup recipe

All daemons + watchers tracked under `gad system status`. Pidfile-guarded
— refuses duplicates.

```sh
# At session start (or after auto-compact)
gad system start                    # idempotent: only spawns missing ones
gad system status                   # see what's running
gad system stop --only datasets-curator   # selective stop
gad system restart                  # graceful cycle

# What's tracked
overnight              ambient curation, hardened (phase 159)
datasets-curator       real-time tuple emission (phase 170)
sessions-watcher       Claude transcript tail → telemetry (phase 89-02)
accounts-poller        per-account quota state (phase 110-erg)
```

The MCP server (`gad mcp serve`) is intentionally NOT auto-started —
it runs over stdio when an MCP client (Claude Code, Cursor) connects.
Singletoning happens at the client side, not the server side.

## Quick verification (operator self-test)

```sh
gad system status                   # see all 4 daemon states
gad ask byok --help                  # confirms phase 158 reachable
gad ask todo --help
gad ask decision --help
gad ask text --help
gad provenance sft-export --since 2026-05-01 --out /tmp/sft   # emits training tuples
ls .planning/.trace-events.jsonl    # logs accumulating
```

If any `gad ask <kind> --help` errors with "Unknown command", the
installed binary is stale; rebuild per the closing-gap section of
`tray-apps-and-mcp-app-pattern.md`.
