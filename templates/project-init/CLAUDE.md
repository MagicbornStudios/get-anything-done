# {{project_name}} Agent Contract

This file mirrors `AGENTS.md` for runtimes that read `CLAUDE.md`.
If the two files diverge, regenerate the mirror from the `AGENTS.md` source.

Project name: `{{project_name}}`
Project id: `{{project_id}}`

## Soul pointer

Read `SOUL.md` first, then read the soul body it points to under
`narrative/souls/` when present. Gilgamesh of Uruk is the default setup soul.
Projects can override that by updating `SOUL.md` with a stable project-specific
soul pointer.

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

- `AGENTS.md` is the source contract.
- `CLAUDE.md` is the runtime mirror.
- `.planning/AGENTS.md` narrows the rules for planning-only edits.
