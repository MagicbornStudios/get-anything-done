---
id: h-2026-04-20T00-00-30-get-anything-done-63
projectid: get-anything-done
phase: 63
task_id: null
created_at: 2026-04-20T00:00:30.828Z
created_by: unknown
claimed_by: team-w1
claimed_at: 2026-04-21T22:47:38.282Z
completed_at: 2026-04-21T22:53:11.118Z
priority: high
estimated_context: mechanical
runtime_preference: codex-cli
---
# Port framework SessionStart/PreTool/PostTool hooks off bash.exe → node

## Problem

`bin/install.js` generates Claude Code hook command strings like
`"C:/Program Files/Git/bin/bash.exe" <path>/gad-session-state.sh` via
`resolveBashCommand()` at `bin/install.js:448-462`.

Under recent Claude Code on Windows, that string gets re-wrapped and bash
tries to interpret `bash.exe` as its script argument, failing with:

```
Failed with non-blocking status code:
C:/Program Files/Git/bin/bash.exe: C:/Program Files/Git/bin/bash.exe: cannot execute binary file
```

Error fires on SessionStart, PreToolUse:Bash, and PostToolUse:Write|Edit.

Operator's live `~/.claude/settings.json` was hotfixed to `node <hook>.js`
(hooks ported to `gad-session-state.js`, `gad-phase-boundary.js`,
`gad-validate-commit.js` at `~/.claude/hooks/`). Next `gad install` run
would re-introduce the broken bash.exe strings → operator blocked.

## Scope of change

### 1. `bin/install.js` — switch hook command generator to node

Call sites to update: `bin/install.js:4339-4340, 4361-4362, 4381-4382`.

Replace `resolveBashCommand(<path>.sh)` calls with a new helper
`resolveNodeCommand(<path>.js)` that emits `node "<abspath>"` (Windows
gets quoted path, POSIX plain). Keep `resolveBashCommand` in place only
if still needed by other call sites (check: `grep -n resolveBashCommand
bin/install.js`).

### 2. Ship node hooks alongside the .sh hooks

Hook source dir `vendor/get-anything-done/hooks/` — add node ports of:

- `gad-session-state.sh` → `gad-session-state.js` (emits soul banner +
  handoff pointer; node port already validated at
  `~/.claude/hooks/gad-session-state.js` — see that file for the shape)
- `gad-phase-boundary.sh` → `gad-phase-boundary.js` (2-line exit-0 stub)
- `gad-validate-commit.sh` → `gad-validate-commit.js` (2-line exit-0 stub)

Keep the .sh files in place for non-Windows users who prefer bash.
Installer picks node on Windows, bash elsewhere (or always node — your
call; node is present everywhere gad runs because gad itself is node).

### 3. Update `bin/install.js:3208` hooks manifest

Add the `.js` filenames to the `gadHooks` copy list so install materializes
both variants.

### 4. Update `tests/hooks-opt-in.test.cjs`

Add existence + executability assertions for `*.js` hooks parallel to the
existing `.sh` assertions (lines 56-86, 172-181, 210, 228, 249, 267, 303,
318, 335, 351, 371, 391, 427, 443).

## Out of scope

- Do NOT touch operator's live `~/.claude/settings.json` — it's already
  hotfixed.
- Skills install paths (`.claude/skills/` → runtime) stay as-is; that's
  a separate skills-on-demand refactor tracked elsewhere.
- `lib/install/editor-converters.cjs` path rewrite (`.claude/skills/` →
  `.cursor/skills/`) is unrelated to this bash.exe class.

## Verification

1. `node bin/install.js --dry-run --global` — inspect emitted settings.json
   hook commands, assert no `bash.exe` substring.
2. `node --test tests/hooks-opt-in.test.cjs` — new assertions pass.
3. Manual: `gad install --claude --global --force` on a Windows test
   profile, then start a Claude Code session → no SessionStart error.

## Related

- Decision gad-275 (shell-profile installer, runtime detection).
- Operator memory: "Claude discusses, Codex implements" lane split
  2026-04-19 — this is why the change is filed here instead of edited
  directly.