# Agent-coordination SITREP — one-line-per-agent cross-terminal status

When the operator runs 3+ agents across terminals (claude-code, codex,
cursor, gemini, subagents), scrolling through five scrollbacks to answer
"who's doing what" costs minutes per check. This template fixes that.

Every primary agent emits a **one-line-per-agent status** whenever asked
"status" / "what are you doing" / "sitrep". Same shape across runtimes so
the operator glance-reads without context-switching.

## The template

```
<runtime> [<agent-id>]  lane=<lane>  phase=<phase>  task=<task-id or handoff-id>  mode=<in-flight|blocked|idle|paused>  since=<HH:MM>  blast-radius=<lib|ui|doc|cli|test|other>  note=<≤60 chars>
```

Examples (real shape, realistic values):

```
claude-code [claude-opus-4-7]  lane=claude-code  phase=63    task=snapshot-bloat  mode=in-flight  since=18:45  blast-radius=lib  note=lib/skill-linter.cjs + types taxonomy, commit pending
codex       [codex-default]    lane=codex        phase=44    task=44-38           mode=in-flight  since=17:22  blast-radius=cli  note=workflows/update.md rewrite; gh release tarball path
cursor      [cursor-default]   lane=cursor       phase=60    task=60-07b          mode=wrapping   since=16:10  blast-radius=ui   note=scoped BYOK tab shipping; env-defaults next
gemini      [gemini-default]   lane=gemini       phase=45    task=45-14           mode=idle       since=—      blast-radius=ui   note=awaiting site rebrand pickup from queue
```

## When to emit

1. **Operator types "status" / "sitrep" / "what are you doing"** across terminals → every agent emits one line.
2. **At session open**, after `gad startup` + `gad handoffs list --mine-first`, before picking work → emit the line so the operator sees orientation.
3. **After every commit** → emit the line so the operator can verify attribution.
4. **When transitioning mode** (in-flight → blocked → paused / completed) → emit once.

Do NOT emit every tool call — that's noise. The line is a **checkpoint**, not a stream.

## Field definitions

| field | values | meaning |
|---|---|---|
| runtime | `claude-code` / `codex` / `cursor` / `gemini` / (other) | Which CLI is speaking |
| agent-id | short identifier | From `.planning/.gad-agent-lanes.json` or the CLI's own id |
| lane | same as runtime OR explicit override | Agent-lanes.md primary-lane column |
| phase | phase id (string, supports decimals like `42.4`) | Current active phase |
| task | `<task-id>` OR `<handoff-id>` OR `—` | What's being worked right now |
| mode | `in-flight` / `blocked` / `idle` / `paused` / `wrapping` | State transitions sharp and coarse |
| since | `HH:MM` local | When current mode began |
| blast-radius | `lib` / `ui` / `doc` / `cli` / `test` / `planning` / `infra` / `other` | One-word hint of where the writes land |
| note | ≤60 chars | One human-readable fragment |

## How to produce it

Every CLI should expose `gad sitrep` that emits the line from that
runtime's perspective. Until wired, produce the line manually at the
checkpoints above. The shape is the contract — the line is what the
operator reads. Agent-id + runtime come from the session's trace or
`.gad-agent-lanes.json`; phase + task come from `gad snapshot --mode=active`
output; mode is agent self-reported.

## Multi-subagent parent lines

When a primary agent has dispatched 2+ subagents, it emits one parent
line plus compact child lines:

```
claude-code [claude-opus-4-7]  lane=claude-code  phase=63  task=evolution-startup  mode=orchestrating  since=18:45  blast-radius=lib  note=2 subagents in flight
  └─ haiku [haiku-bg-01]  task=skill-frontmatter-wave-3  mode=in-flight  note=tagging ~20 workflow skills
  └─ sonnet[sonnet-bg-02] task=llm-from-scratch/01-02    mode=in-flight  note=corpus stager
```

Tree format is still one-line-per-agent — the └─ glyph preserves
glance-readability.

## Across-terminal consolidation

Operator runs `gad sitrep --all` (future CLI) in any terminal; that
command reads `.planning/.gad-agent-lanes.json` + recent `.gad-log/*.jsonl`
+ active handoffs, assembles every agent's latest checkpoint line, prints
them together. Until that CLI lands, operator asks each terminal "sitrep"
and scrolls the four outputs.

## Why this shape

- **One line per agent** — nothing scales past this when you have 4+
  concurrent terminals. Multi-line SITREPs force the operator to
  re-orient per agent.
- **Fixed field order** — the eye finds `mode=blocked` at the same
  horizontal position in every line.
- **`mode=blocked`** is the single most important field — it's what the
  operator needs to unstick. Put it right after `task=`.
- **`blast-radius`** is the triage hint — operator instantly sees whether
  an agent is touching hot infrastructure or just docs.
- **`note` capped at 60 chars** forces discipline. Longer thoughts go in
  a commit or a handoff body.

## Related

- `references/communication-style.md` — SITREP register (the baseline)
- `references/agent-lanes.md` — lane assignments this SITREP reports against
- `skills/gad-handoffs/SKILL.md` — how work moves between agents
- `feedback_compact_response_format.md` — operator's compact-format preference
