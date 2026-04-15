# Onboard flow — design (task 42.2-38, umbrella 44-28)

Date: 2026-04-15
Context: operator flagged that `bin/install.js` on its own installs a
runtime (skills + agents + hooks) but doesn't scaffold a consumer
project — a new user double-clicking the exe ends up with a configured
Claude runtime and no `.planning/` state, and has no idea `gad projects
init` even exists.

## Goal

One double-clickable flow that gets a new user to a working GAD project:

1. Install runtime skills for their chosen coding-agent runtime(s).
2. Scaffold `.planning/` with canonical XML ledgers in a user-chosen
   folder (sensible default so nothing gets dumped raw on the desktop).
3. Print next-steps pointing at the right `gad snapshot` + launch
   command for their runtime.

## Shape

Extend the existing interactive prompt chain in `bin/install.js`:

1. `promptRuntime()` — unchanged, multi-select over the 9 runtimes.
2. `promptLocation()` — gains a **third** option alongside Global/Local:
   - `1) Global` — existing, installs to `~/.claude/` etc.
   - `2) Local`  — existing, installs to `./.claude/` in cwd.
   - `3) New GAD project folder` — **new**.
3. If choice 3: `promptNewProjectFolder()`:
   - Default path suggestion: `<os.homedir()>/Desktop/my-gad-project`
   - Operator can accept the default (enter), edit inline, or paste
     any absolute path.
   - If the directory doesn't exist → create it.
   - If the directory exists and has files → warn + confirm before
     proceeding. Empty existing dir = silent OK.
   - Change process.cwd() to the chosen folder so the existing
     `installAllRuntimes(runtimes, false, true)` local-install codepath
     writes into it without further changes.
4. Install runtime skills (existing installAllRuntimes path).
5. After install completes, spawn
   `node <this-repo>/bin/gad.cjs projects init --path <folder>`
   as a child process to scaffold `.planning/`.
6. Print a tailored SITREP:
   ```
   ✓ GAD project ready at <folder>
     cd "<folder>"
     <runtime-launch-command>
   Next: gad snapshot --projectid <folder-basename>
   ```

## Non-interference contract

The operator's hard constraint: the onboard flow must never disturb
existing global or existing local installs.

| Concern | How it's handled |
|---|---|
| Existing `~/.claude/skills/gad-*` from prior global install | Untouched — onboard flow is a **local** install, never writes to `~/.claude/` |
| Existing cwd with its own `.claude/` | Untouched — onboard flow uses a **new** folder, not cwd |
| Existing non-empty folder user picks | Warn + confirm before overwriting anything |
| Runtime CLI installation (Claude Code, Codex, etc.) | **Never bundled** — detect-and-report only |
| GAD framework update running against an existing install | Existing `--uninstall` / update paths unchanged |

## Default folder choice

Pattern: `<os.homedir()>/Desktop/my-gad-project`. Rationale:

- Visible to the user immediately (Desktop) — they can find it.
- Distinct named folder — avoids dumping skills/ + .planning/ + hooks/
  raw onto the Desktop root.
- "my-gad-project" is generic enough to feel like a placeholder the
  user is expected to rename, not a system folder.
- On non-Windows systems the `Desktop` dir is standard enough that the
  default still makes sense.
- If `~/Desktop` doesn't exist, fall back to `~/my-gad-project`.

## Flags (scriptable parallel)

- `--new-project <path>` — skips the interactive prompts and runs the
  onboard flow against the given path. Used by test harnesses and power
  users.
- Existing `--global`, `--local`, `--config-dir` still work unchanged.

## Not in scope (for 42.2-38)

- Portable Node bootstrap (that's task 44-34).
- Self-contained site launcher inside the project (that's task 44-33).
- Uninstall-onboarded-project ("`gad uninstall --project <path>`") —
  can follow once the create path is stable.
- Multi-project onboarding in one run — one folder per invocation.
- Bundling Claude Code / Codex CLIs — explicit non-goal.

## Test plan

1. Interactive path: pipe `4\n3\n\n` into `node bin/install.js` against
   a tmp dir, verify skills land at `<tmp>/.claude/skills/` AND
   `.planning/` scaffold exists.
2. Scriptable path: run
   `node bin/install.js --claude --new-project <tmp>` non-interactively,
   verify the same end state.
3. Folder-exists-non-empty path: create `<tmp>/something.txt`, run
   `--new-project <tmp>`, verify the warning fires.
4. Default-folder resolution: verify `os.homedir() + /Desktop/my-gad-project`
   is offered as the default.

## Open questions (not blocking first cut)

- **Windows double-click behavior.** When a user double-clicks an exe
  built via Node SEA from bin/install.js on Windows, the terminal
  window opens, runs, and closes immediately on exit. Need a "press any
  key to close" hold at the very end — otherwise the user sees their
  SITREP flash and vanish. Probably worth a `--hold-on-exit` flag that
  interactive mode implicitly sets.
- **Runtime CLI detection.** First cut does not check whether the user
  actually has Claude Code / Codex / etc. installed. If they pick a
  runtime whose CLI they don't have, the skills land but the exe
  silently does nothing useful. A detect-and-report pass is worth a
  follow-up task.
