# {{project_name}} Agent Contract

Project name: `{{project_name}}`
Project id: `{{project_id}}`

If a `SOUL.md` pointer exists in this repo, read it first and follow it to
the narrative body under `narrative/souls/`. If it doesn't exist, skip this
step — souls are opt-in via `gad souls init`.

{{project_intent}}
## Loop

Use this loop every session:

1. `gad snapshot --projectid {{project_id}}`
2. Pick one task
3. Implement the task
4. `gad tasks stamp <task-id> --projectid {{project_id}} --status done --agent <agent> --runtime <runtime>`
5. `gad state log "<delta>" --projectid {{project_id}}`
6. Commit

## Planning IDs

Use canonical IDs exactly:

| Entity | Format |
|---|---|
| decisions | `{{project_upper}}-D-<n>` |
| tasks | `{{project_upper}}-T-<phase>-<n>` |
| handoffs | `h-<ISO>-{{project_id}}-<phase>` |
| requirements | `{{project_upper}}-R-<n>` |
| errors | `{{project_upper}}-E-<n>` |

## Communication style

- SITREP format.
- Tables when structure helps.
- Report deltas only.
- Always close with gaps.
- Call entities by registered name, not shorthand.

## GAD CLI quick reference

| Command | Purpose |
|---|---|
| `gad snapshot --projectid {{project_id}}` | Hydrate planning context before work |
| `gad tasks list --projectid {{project_id}}` | Inspect available work |
| `gad tasks stamp <task-id> --projectid {{project_id}} --status done --agent <agent> --runtime <runtime>` | Stamp task completion |
| `gad state log "<delta>" --projectid {{project_id}}` | Append a state-log entry |
| `gad decisions add {{project_upper}}-D-<n> --projectid {{project_id}} --summary "..."` | Record a decision |
| `gad handoffs list --projectid {{project_id}}` | Inspect open handoffs |
| `gad handoffs claim <handoff-id>` | Claim a handoff |
| `gad handoffs complete <handoff-id> --by <runtime>` | Close a handoff |

## Lane discipline

Single-agent by default. Use multi-agent execution only when `gad team`
is active and the work has been explicitly split into lanes.

## Files

- `AGENTS.md` (this file) — the source contract for every runtime.
- `CLAUDE.md` — Claude Code entrypoint, points back here with
  Claude-only addenda (skills, subagents, harness tools).
- `.planning/AGENTS.md` — narrows the rules for planning-only edits.

Other runtime entrypoints (`.cursorrules`, codex `AGENTS.md`, `GEMINI.md`,
`.opencode/AGENTS.md`, etc.) are **not scaffolded by default**. Add one
only when you actually adopt that runtime on this project; otherwise it
just becomes noise in the repo root. When you do add one, keep it thin —
read `AGENTS.md` and append runtime-specific addenda only.
