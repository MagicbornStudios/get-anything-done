# Handoff queue design (task 60-09) — 2026-04-18

Refinement from operator: JSONL index rejected as merge-conflict bait. Use per-file directory instead. The directory listing IS the index — no central file to contend on.

## Shape

```
.planning/handoffs/
├── open/
│   ├── h-<timestamp>-<projectid>-<short>.md   # unclaimed handoff
│   └── ...
├── claimed/
│   └── h-<...>.md                              # moved here when claimed (atomic fs rename)
└── closed/
    └── h-<...>.md                              # moved here when complete
```

Each handoff file has YAML frontmatter + markdown body. Lifecycle = file move (`open/` → `claimed/` → `closed/`). `fs.rename` is atomic on same filesystem, no lock needed.

## Frontmatter

```yaml
---
id: h-mo3p2b87-gad-42.4-context-framework
projectid: get-anything-done
phase: 42.4
task_id: 42.4-24              # optional
created_at: 2026-04-18T15:00:00Z
created_by: claude-opus-47     # runtime + agent lane
claimed_by: null               # nulled while in open/
claimed_at: null
completed_at: null
priority: normal               # low | normal | high
estimated_context: mechanical  # mechanical | reasoning — for offload-to-cheaper-models policy
---
```

Body is the freeform markdown the author would have written anyway (what was in progress, what's next, gotchas, file pointers).

## CLI surface (to build)

| Command | Action |
|---|---|
| `gad handoffs list [--unclaimed]` | List files in `open/` (default) or all buckets |
| `gad handoffs claim <id> [--agent <name>]` | `fs.rename` from `open/` to `claimed/`, rewrite frontmatter |
| `gad handoffs complete <id>` | `fs.rename` from `claimed/` to `closed/`, set `completed_at` |
| `gad handoffs show <id>` | Print file content |
| `gad handoffs create ...` | Write new file in `open/` — invoked by `gad pause-work` / `gad session pause` |

## Startup integration

`gad startup` and `gad snapshot` surface unclaimed count inline. When > 0:

```
-- HANDOFFS (3 unclaimed) ---------------------------------
  h-...-context-framework    42.4   normal  mechanical
  h-...-byok-tab-keys-fetch  44.5   normal  reasoning
  h-...-snapshot-format      42.4   high    mechanical
-- end handoffs ------------------------------------------
```

Idle agent reads this, picks one appropriate for its model tier (mechanical → Haiku/Sonnet, reasoning → Opus), claims it, works it.

## Why per-file beats JSONL

- **No central write contention.** Every agent writes its own file. Directory listing is the index.
- **Atomic lifecycle via fs.rename.** No lock files, no retry loops. POSIX and Windows both atomic on same mount.
- **Git-friendly diffs.** One handoff = one file. Adding/removing handoffs doesn't rewrite a shared JSONL.
- **Grep-navigable.** `rg phase:42.4 .planning/handoffs/` gives instant filtered view.
- **Stale-handoff scan is trivial.** `find open/ -mtime +7` flags abandoned work.

## Relation to 60-09 task registry entry

The 60-09 task was originally filed with the JSONL design. This note is the canonical design. Updating the task goal requires a `gad tasks update` command that doesn't yet exist — surfacing the gap. In the meantime, the task references this note.

## Gap surfaced

`gad tasks` has `add | list | claim | release | active | promote | stalled`. No `update`. File gap when implementing 60-09: either add `gad tasks update <id> --goal "..."` or rely on design-note pattern and keep task goals terse. Recommend the former — goals drift during discuss-phase and an in-CLI update is cheaper than a note-per-revision.
