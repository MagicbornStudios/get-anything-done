# Sweep E: extract state/note/todos to bin/commands/

**Agent:** opus-claude

**Source:** session 2026-04-19 sweep E

## What

`bin/gad.cjs` was 18,437 LOC. Sweep E carves 3 small command families
into `bin/commands/`:

| Family | New file | LOC removed from gad.cjs |
|---|---|---|
| `state` (show / set-next-action / log) | `bin/commands/state.cjs` | 234 |
| `todos` (list / add) | `bin/commands/todos.cjs` | 78 |
| `note`  (list / add) | `bin/commands/note.cjs`  | 95 |

Net: gad.cjs 18,437 → 18,181 (-256 LOC after factory invocation
boilerplate). Net behavior: zero change.

## Why factory-receives-deps (not direct require of helpers)

The "obvious" refactor is move helpers (`findRepoRoot`, `resolveRoots`,
`outputError`, etc.) into `lib/cli-helpers.cjs` and have command modules
require them directly. **Blocked by transitive dependencies:**
`resolveRoots` calls `getActiveSessionProjectId` calls `loadSessions`
(line 9305) which itself depends on session-state schemas defined inside
gad.cjs. Extracting that chain is ~9,000 LOC of dependency surgery —
high risk for one sweep.

Factory pattern sidesteps this entirely. Command modules know nothing
about helper sources — they accept them as deps. gad.cjs builds the
deps object from local scope at module-load time. Future sweeps can
move helpers into `lib/cli-helpers.cjs` and swap the modules from
factory to direct require with zero behavior change.

## Hoisting fix

`graphExtractor` was required at line 16,750 (LATE). State factory
needs it at module-load time. Moved the require to the top imports
block (line ~99).

`maybeRebuildGraph` is a `function` declaration so it hoists — no fix
needed.

## Verification

- `node bin/gad.cjs state show --projectid get-anything-done` → table renders.
- `node bin/gad.cjs state log "..." --tags ...` → appends entry to `<state-log>`.
- `node bin/gad.cjs state set-next-action --help` → subcommand reachable.
- `node bin/gad.cjs note --help` → subcommand listing.
- `node bin/gad.cjs note list --projectid get-anything-done` → 30+ notes listed.
- `node bin/gad.cjs todos list --projectid get-anything-done --json` → valid JSON array.
- `node --test tests/graph-extractor.test.cjs` → 10/10 pass.
- `tests/state.test.cjs` fails identically on clean main (pre-existing
  bug: `Cannot find module '../lib/state.cjs'`). Not caused by sweep E.

## What's next (planned sweeps)

- **Sweep F** — extract `phases`, `decisions`, `handoffs` (3 more small
  families). Same factory pattern. Target: gad.cjs under 17,500 LOC.
- **Sweep G** — extract shared helpers into `lib/cli-helpers.cjs`.
  Includes the transitive `resolveRoots` chain. Switch existing extracted
  modules from factory to direct requires.
- **Sweep H** — extract larger families (`tasks`, `eval`, `species`,
  `session`). These are 1k+ LOC each.

Goal: gad.cjs < 5k LOC of dispatcher + cross-cutting glue, all command
implementations in `bin/commands/`.

## Token-cost rationale (operator question)

Reading `bin/gad.cjs` cold: ~546k tokens (18.4k lines × 30 tok/line
avg). Sweep E reduces that by ~7k tokens, but the bigger win is that
agents working on `state` / `note` / `todos` can now read just their
~250-LOC module (~7.5k tokens) instead of the whole file. Aggregate
agent-context savings will scale with each sweep.
