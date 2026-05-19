# rtk (Rust Token Killer) — install runbook + hook anatomy

Phase 260 (2026-05-18). Token-saving proxy that rewrites read-only Bash
calls — `git status`, `ls -la`, `grep`, `cat`, etc. — into a more compact
form before they reach the LLM context. Live numbers from the global
rtk gain rollup at phase-260 close: **120.1M input tokens, 119.9M saved,
99.8% efficiency over 588 commands**.

This doc covers: (1) install / verify, (2) hook anatomy, (3) gad
integration surfaces, (4) common pitfalls.

## 1. Install + verify

### Binary

| OS / shell | Path | Source |
|---|---|---|
| Windows | `%USERPROFILE%\.local\bin\rtk.exe` | Releases on https://github.com/leg100/rtk |
| macOS / Linux | `~/.local/bin/rtk` | Same |

`PATH` must include the install dir. Verify:

```sh
rtk --version       # rtk 0.40.0 (or newer)
which rtk           # POSIX
where.exe rtk       # Windows
```

### Hook install

```sh
rtk init -g         # global — patches ~/.claude/settings.json
rtk init            # project-local — patches ./.claude/settings.json
```

The hook entry that lands in settings.json:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"C:/Users/<you>/.local/bin/rtk.exe\" hook claude"
          }
        ]
      }
    ]
  }
}
```

On Windows the path uses forward slashes inside the JSON string — claude-code
parses both, but forward slashes survive JSON re-serialization without
extra escaping.

### Smoke

```sh
rtk gain                   # show savings dashboard
rtk gain -f json           # machine-readable
rtk gain -H                # recent command history
rtk gain --reset --yes     # zero stats (rarely needed)
```

If `rtk gain` ever prints `[warn] No hook installed — run \`rtk init -g\``
even though `~/.claude/settings.json` has the hook entry, claude-code
isn't picking the hook up. Usual causes:

- claude-code wasn't restarted after `rtk init -g`.
- The hook command path is broken on this machine (`rtk.exe` moved /
  uninstalled). Check `which rtk` matches the path in settings.json.
- `node-noflash.exe` wrapper has been retrofitted between claude-code
  and the rtk binary (see CLAUDE.md memory `project_node_noflash_wrapper.md`).
  The wrapper is fine for Node-based hooks but must NOT wrap rtk itself —
  rtk is a Rust binary and the wrapper expects a Node argv.

### Name collision

```sh
which rtk
```

Should resolve to leg100/rtk (Rust Token Killer). If it resolves to
reachingforthejack/rtk (Rust Type Kit), one of the two installs has the
PATH priority and the other is shadowed. `rtk gain` failing with
"unrecognized subcommand" is the canonical symptom.

Workaround: set `workflow.rtk.binary_path` in gad user settings.toml to
the absolute path of leg100/rtk, then gad surfaces invoke the right
binary regardless of PATH order.

## 2. Hook anatomy

The hook executes once per Bash tool call, BEFORE the tool reaches the
LLM. rtk reads the tool input on stdin (`{"tool_input": {"command":
"..."}}`), rewrites whitelisted commands into `rtk <cmd>`, and writes
the rewritten input back on stdout. claude-code substitutes the rewritten
command for the original.

Rewrite map (representative, not exhaustive — see `rtk help` for full
list):

| Original | Rewritten | Token reduction |
|---|---|---|
| `git status`, `git diff`, `git log` | `rtk git ...` | ~60-80% on noisy repos |
| `ls -la <path>` | `rtk ls -la <path>` | ~50-70% on large dirs |
| `grep -r <pattern>` | `rtk grep ...` | ~15-25% (very high volume) |
| `cat <file>` (small) | `rtk read <file>` | ~10-15% |
| `find <dir>` | `rtk find ...` | varies |

rtk's claim isn't lossless compression — it's a deliberate trade-off:
**summarize verbose CLI output into the format an LLM actually needs**.
For `git status`, that means "list of changed files + branch", not the
full prose. For `ls -la`, "names + sizes + types", not full permission
strings + owner + group + atime.

Each invocation gets logged to rtk's local stats DB (path varies by OS;
on Windows it's typically under `%APPDATA%\rtk\stats.db`). `rtk gain`
reads that DB.

## 3. gad integration surfaces

### Settings registry

Two registry entries (see `vendor/get-anything-done/lib/settings-registry.cjs`):

| Key | Type | Default | Purpose |
|---|---|---|---|
| `workflow.rtk.enabled` | boolean | `false` | gad-side intent. When true, gad surfaces treat rtk as active (telemetry collection, savings panels). Independent of whether the hook is actually wired — gad doesn't probe claude-code's settings.json. |
| `workflow.rtk.binary_path` | `string \| null` | `null` | Absolute path override. `null` = auto-detect via PATH. Set when multiple rtk variants are installed. |

Env equivalents: `GAD_RTK_ENABLED`, `GAD_RTK_BINARY_PATH`.

Read from CLI:

```sh
gad settings get workflow.rtk.enabled
gad settings set workflow.rtk.enabled true
```

### Telemetry tracker

`vendor/get-anything-done/lib/rtk-tracker.cjs` is the canonical entry
point. Functions:

- `resolveRtkBinary({ projectRoot, binary? })` — returns absolute path
  to rtk binary, or `null` if not found. Resolution order: explicit
  override → setting → env → PATH → well-known install paths.
- `capture({ projectRoot, project?, projectScope? })` — invokes
  `rtk gain -f json`, appends a snapshot record to
  `.planning/.gad-log/rtk-gains.jsonl`, and returns
  `{ ok, record, path }`.
- `readAll({ projectRoot, logPath? })` — read all snapshots,
  oldest-first.
- `weeklyDelta({ projectRoot, weekStartIso, weekEndIso })` — compute
  `{ delta_commands, delta_saved, savings_pct, first_ts, last_ts,
  snapshots }` for snapshots in a given window. Used by the build-metrics
  weekly rollup.

Snapshot record shape (one JSON object per JSONL line):

```json
{
  "ts": "2026-05-19T05:13:29.515Z",
  "binary": "C:\\Users\\benja\\.local\\bin\\rtk.exe",
  "version": "rtk 0.40.0",
  "total_commands": 578,
  "total_input": 120166506,
  "total_output": 219685,
  "total_saved": 119947745,
  "avg_savings_pct": 99.8179517676914,
  "total_time_ms": 43694052,
  "avg_time_ms": 75595,
  "delta_commands": null,
  "delta_saved": null,
  "project": "global",
  "scope": "global"
}
```

`delta_commands` / `delta_saved` are `null` on the first snapshot, then
the diff vs the prior snapshot's `total_commands` / `total_saved`.

Suggested cadence: capture on session-open and every ~hour during a
session. A desk-hook tick at 1h cadence (`.planning/desk-hooks/rtk-capture.mjs`)
is a natural fit, but not yet shipped — phase 260 left it as future work.

### Build-metrics rollup

`gad desk build-metrics rollup` (see `.planning/commands/desk.cjs`)
extends the weekly rollup with an `rtk` block per week:

```json
{
  "week": "2026-W21",
  "builds": 7,
  "rtk": {
    "snapshots": 3,
    "delta_commands": 1,
    "delta_saved_tokens": 217,
    "savings_pct": 14.64,
    "first_snapshot_ts": "2026-05-19T05:13:29.515Z",
    "last_snapshot_ts": "2026-05-19T05:14:51.282Z"
  }
}
```

If no rtk-gains snapshots exist for the week (or rtk-tracker isn't
loadable for some reason), the `rtk` field is `null` — rollup still
writes, builds column unchanged.

### Baseline file

`.planning/build-metrics/raw/rtk-baseline.json` is a one-time capture
recorded at phase-260 close. It does NOT participate in the weekly
build rollup — `readAllRawMetrics` filters `rtk-*.json` and entries
lacking `started_at` + `version`.

## 4. Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `rtk gain` warns "No hook installed" but settings.json has the entry | claude-code didn't reload | Restart claude-code session. |
| `rtk gain --reset` requested but stats keep accumulating | Stats DB locked by a running rtk hook on another claude session | Close all claude-code sessions first, then reset. |
| Token savings numbers look implausibly high (99.8%) | A handful of `rtk grep` calls account for almost all of total_input | This is normal — rtk grep on a large codebase reduces 5-10 MB of raw output to a few KB. Look at `rtk gain -H` to see the distribution by command type. |
| `which rtk` resolves to reachingforthejack/rtk | PATH order has Rust Type Kit before Rust Token Killer | Reorder PATH or set `workflow.rtk.binary_path`. |
| rtk-tracker `capture` returns `{ ok: false, reason: "rtk binary not found" }` from a gad command | The CLI's spawn environment doesn't inherit the user's interactive PATH | Set `GAD_RTK_BINARY_PATH` env var or `workflow.rtk.binary_path` setting. |
| `delta_commands` and `delta_saved` are large negative numbers | rtk stats were reset between snapshots | Expected — drop the snapshot or treat negatives as null in your consumer. |

## References

- Phase 260 plan: `.planning/phases/phase-260-rtk-vendor.md` (if filed)
- rtk upstream: https://github.com/leg100/rtk
- Task chain:
  - GLOBAL-T-260-01..03 — audit + binary install + hook wire (done)
  - GLOBAL-T-260-04 — settings registry entries
  - GLOBAL-T-260-05 — `rtk-tracker.cjs` telemetry capture
  - GLOBAL-T-260-06 — baseline capture
  - GLOBAL-T-260-07 — weekly rollup column
  - GLOBAL-T-260-08 — this doc
- Phase 264 (next): vendor rtk + write PreToolUse hook processors for
  codex-cli + opencode (rtk has native hooks for claude / cursor /
  gemini / copilot; codex + opencode integrations are partial / broken
  upstream).
