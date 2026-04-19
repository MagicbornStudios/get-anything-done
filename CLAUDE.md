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
- **TASK-REGISTRY.xml** — single 2k-line file, edit one task block at a
  time, never bulk-rewrite. Use `gad tasks` CLI when possible.
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

## Test before committing

```sh
node bin/gad.cjs --version       # smoke
node --test tests/<your-area>.test.cjs   # targeted
```

CI runs the full suite; commit only after the targeted area passes locally.
