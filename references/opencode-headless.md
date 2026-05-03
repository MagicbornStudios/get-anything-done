# OpenCode Headless Notes

Verified on 2026-05-03 against `opencode` v`1.14.33`.

## Working command shape

Use `run`, not the TUI:

```bash
node scripts/gad-opencode-trial.mjs -- run --format json
```

Behavior confirmed from source and local smoke:

- `opencode run [message..]` is the non-interactive entrypoint.
- If stdin is piped, `run.ts` appends `Bun.stdin.text()` to the prompt body.
- `--format json` emits nd-json style event lines (`step_start`, `tool_use`, `text`, `step_finish`) to stdout.
- File writes worked headlessly in local smoke without `--dangerously-skip-permissions`.

## Stdin contract

These both worked locally:

```bash
echo "Say exactly OK." | node scripts/gad-opencode-trial.mjs -- run --format json
echo "Say exactly OK." | node scripts/gad-opencode-trial.mjs -- run --format json "stdin prefix"
```

The team worker path can therefore keep its existing `cat prompt.md | <runtime_cmd>` contract.

## Concurrency caveat

OpenCode stores its SQLite DB under `XDG_DATA_HOME/.../opencode.db` and will fail at:

```text
Failed to run the query 'PRAGMA journal_mode = WAL'
```

if multiple worker processes share the same data dir.

Required mitigation for team workers:

- set a unique `XDG_DATA_HOME` per worker process
- keep `OPENCODE_CONFIG_DIR` shared so repo-local config/plugins still load

`scripts/gad-opencode-trial.mjs` now defaults `XDG_DATA_HOME` to:

```text
.tmp/opencode-data/<GAD_TEAM_WORKER_ID|default>
```

which makes concurrent opencode workers safe under the GAD team loop.
