# Working inside the GAD vendor submodule

This file exists because agents working **inside** `vendor/get-anything-done/`
have different rules than agents working at monorepo root. Read this first.
Full agent guidance is in `AGENTS.md`. This file is the short list of things
that bite specifically when you're modifying GAD itself.

## Which `gad` to invoke

| Context | Command |
|---|---|
| Modifying GAD source — verifying your change | `node bin/gad.cjs <args>` |
| Using GAD to plan/snapshot work — read-only | `gad <args>` (installed binary, may be one release behind) |
| `site serve` only (until v1.34) | `node bin/gad.cjs site serve` (binary has bug) |

The installed `gad.exe` at `%LOCALAPPDATA%\Programs\gad\bin\gad.exe`
**does not pick up your local source changes** until the next release. If
you patched `bin/gad.cjs` and want to verify, you must invoke
`node bin/gad.cjs ...` directly. This bites every agent that doesn't know.

## Diff hygiene (post-2026-04-19 sweeps)

The following are **gitignored** — never `git add` them, even if `git status`
shows them. They are derived/local-only and regenerate on demand:

| Pattern | Source |
|---|---|
| `.planning/graph.json`, `.planning/graph.html` | `gad graph build`, auto-rebuilt by `gad snapshot`/`gad startup` |
| `.planning/.trace-events.jsonl`, `.planning/.trace-seq` | `bin/gad-trace-hook.cjs` (every CLI call) |
| `.planning/.gad-log/*.jsonl` | daily CLI call log |
| `.planning/sessions/s-*.json` | per-agent session state from `gad startup` / `gad session new` |
| `site/lib/*.generated.{ts,json}` | `npm run prebuild` → `site/scripts/build-site-data.mjs` |
| `site/data/*.json` | same prebuild |
| `site/public/llms.txt`, `site/public/llms-full.txt`, `site/public/api/docs.json` | same prebuild |
| `site/public/downloads/*.zip`, `site/public/downloads/planning/*.zip` | same prebuild |

If `git status` ever shows phantom modifications you didn't make, run
`git add --renormalize .` — `.gitattributes` enforces LF in the index, and
this command brings any drifted working copies back in line.

## Multi-agent coordination

- **Set `GAD_AGENT_NAME`** in your environment (e.g. `opus-claude`,
  `claude-lane`, `gpt5-codex`). It auto-fills the agent slug in note
  filenames and state-log entries — without it those things land as
  `unknown` and you create attribution holes.
- **Handoffs queue** (`.planning/handoffs/`) — work-stealing. Always check
  `gad handoffs list --mine-first` before picking up new work; another
  agent may have already claimed it. Use `gad handoffs claim <id>` (rename
  to `claimed/`) and `gad handoffs complete <id>` (rename to `closed/`).
- **STATE.xml `<next-action>`** is now reserved for "what should the next
  agent do RIGHT NOW" — keep it short. **Do NOT rewrite it with essays.**
  Use `gad state log "<one-line summary>" --tags ...` to append a new
  `<entry>` to the `<state-log>` block (newest-first, atomic). The log
  preserves prior context across agents instead of overwriting it.

  ```sh
  gad state log "Closed 44-13 — projects init bug fix" --tags "44-13" --projectid get-anything-done
  ```
- **Tasks** — per-task JSON files at `.planning/tasks/<id>.json` are
  the sole source of truth (63-53, 2026-04-22). Use `gad tasks add /
  update / stamp / promote` — never hand-edit the JSON. Legacy
  `TASK-REGISTRY.xml` was retired; `gad tasks migrate` remains as a
  one-shot import path for older projects inheriting XML.
- **Notes** in `.planning/notes/` — filename pattern is
  `YYYY-MM-DD[-<agent>]-<slug>.md`. Use `gad note add <slug>` (not direct
  `Write` to the dir) — it auto-fills the agent slug from `$GAD_AGENT_NAME`.

  ```sh
  gad note add context-surgery-findings --title "Context surgery test results" --body "..." --projectid get-anything-done
  ```
- **Long-form context** (designs, postmortems, planning artifacts) → notes
  via `gad note add`. **One-line state changes** (started/finished/handed-off
  a task) → `gad state log`. Don't conflate them.

## Sessions / startup

```sh
gad startup --projectid get-anything-done   # full snapshot, creates session
gad snapshot --projectid get-anything-done   # subsequent calls, downgrades to active mode
```

Sessions are local-only state — never commit them, never expect another
agent to read yours. After auto-compact, prefer working memory over
re-running full snapshot (cf. monorepo `CLAUDE.md`).

## Dead-code traps in `bin/gad.cjs`

Sweep D-4 (2026-04-19) deleted the V1 dupes for `snapshotCmd` and
`tasksCmd` — the live ones are now the only ones, no `V2` suffix. If you
ever see two `defineCommand` blocks for the same command name, **always
check the dispatcher** (`grep -nE "^    snapshot:|^    tasks:|^    context:" bin/gad.cjs`)
to see which is wired before patching. Don't introduce new V2-style dupes
— refactor the existing one in place.

## Modular commands (post-2026-04-19, sweep E)

`bin/gad.cjs` is being broken up. Sweep E moved 3 small command families
out of the monolith:

| File | Exports | Family |
|---|---|---|
| `bin/commands/state.cjs` | `createStateCommand(deps)` | `gad state show / set-next-action / log` |
| `bin/commands/note.cjs`  | `createNoteCommand(deps)`  | `gad note list / add` |
| `bin/commands/todos.cjs` | `createTodosCommand(deps)` | `gad todos list / add` |

**Pattern: factory that receives helpers as deps.** Each module exports
`function create<Family>Command(deps)` that returns a `defineCommand(...)`
object. `gad.cjs` imports the factory near the top, then invokes it where
the original cmd was defined, passing `{ findRepoRoot, gadConfig,
resolveRoots, outputError, ... }` from local scope.

**Why the factory pattern instead of direct requires of helpers from a
new `lib/cli-helpers.cjs`?** Because `resolveRoots` calls
`getActiveSessionProjectId` calls `loadSessions` — extracting that whole
chain is a 9k-LOC dependency graph. The factory pattern lets us pull
commands out today without touching helpers; later sweeps can extract the
helpers and switch the modules to direct requires.

**To extract another command family in your sweep:**

1. Identify a `defineCommand` block (or sibling group + dispatcher) you
   want to move. Map its dependencies (search for `findRepoRoot`,
   `gadConfig.load`, `resolveRoots`, `outputError`, `render`,
   `shouldUseJson`, plus any module-level requires it touches).
2. Create `bin/commands/<family>.cjs`. Top: `'use strict';`, `const path
   = require('path'); const fs = require('fs'); const { defineCommand } =
   require('citty');`. Body: `function create<Family>Command(deps) { const
   { ... } = deps; const cmdA = defineCommand(...); ... return
   defineCommand({ subCommands: { ... } }); }`. Bottom:
   `module.exports = { create<Family>Command };`.
3. In `bin/gad.cjs`: add `const { create<Family>Command } =
   require('./commands/<family>.cjs');` near the other command-module
   imports. Replace the original inline block with `const <family>Cmd =
   create<Family>Command({ ... });`. Keep the var name so the dispatcher
   doesn't change.
4. Smoke: `node bin/gad.cjs <family> --help`, plus a real subcommand
   call. Then `node --test tests/<related-area>.test.cjs`.
5. Update this section's table with the new module.

**Don't add to the monolith.** New commands go straight into
`bin/commands/<family>.cjs`.

## Test before committing

```sh
node bin/gad.cjs --version       # smoke
node --test tests/<your-area>.test.cjs   # targeted
```

CI runs the full suite; commit only after the targeted area passes locally.
