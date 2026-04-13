# GET ANYTHING DONE

GAD is an operational CLI, planning framework, and evaluation system for coding-agent workflows.
It is not a coding-agent runtime by itself. You run GAD alongside Claude Code, Codex, and the
other supported runtimes to keep planning, telemetry, eval preservation, and human review
coherent as the work scales.

GAD exists because raw agent sessions drift. Context gets noisy, plans go stale, evals become
hard to compare, and you stop knowing whether progress came from a better agent, a better
framework, or just a different prompt. GAD is the layer that makes those runs operational.

## What GAD does

- gives repos a living planning loop
- keeps agent work tied to explicit project state
- scaffolds controlled eval runs with preserved code, builds, logs, and review data
- tracks runtime identity so Claude Code vs Codex comparisons can be first-class
- ships skills, hooks, templates, and agents as framework assets instead of one-off prompts

## What GAD is not

- not a replacement for Claude Code, Codex, Cursor, or another coding runtime
- not a hosted agent platform
- not an npm-first package flow
- not a site-only system; the CLI and preserved artifacts work without the Magicborn site

## Install

Primary install path: GitHub Release executable.

Download the current release asset for your platform from GitHub Releases:

- `gad-v<version>-windows-x64.exe`
- `gad-v<version>-linux-<arch>`
- `gad-v<version>-macos-<arch>`

### Windows

Portable use:

```powershell
.\gad-v1.32.0-windows-x64.exe --help
```

Global install:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-gad-windows.ps1 -Artifact .\gad-v1.32.0-windows-x64.exe
```

Or install from the packaged executable itself:

```powershell
.\gad-v1.32.0-windows-x64.exe install self
```

### Linux and macOS

Use the matching GitHub Release artifact and run it directly. GAD’s packaged runtime extracts
its support tree on first run, so end users do not need Node just to use the CLI.

## Optional Node / GitHub path

If you already have Node and want to work from a checkout:

```bash
git clone https://github.com/MagicbornStudios/get-anything-done.git
cd get-anything-done
npm install
node scripts/build-cli.mjs
node dist/gad.cjs --help
```

This is the source/development path, not the primary user install path.

## Skills

CLI installation and skill installation are separate.

Install the published GAD skills from GitHub with `skills.sh`:

```bash
npx skills add https://github.com/MagicbornStudios/get-anything-done
```

Install one specific skill:

```bash
npx skills add https://github.com/MagicbornStudios/get-anything-done --skill framework-upgrade
```

This installs methodology/content assets. It does not install the `gad` executable.

## Supported runtime model

GAD is built to operate with multiple coding-agent runtimes. Current first-class focus is:

- Claude Code
- Codex

The framework also carries install/transpilation support for additional runtimes where practical.
The important split is:

- coding runtime does the work
- `gad` manages the operational layer
- skills/hook assets install into the runtime-specific format

## Quick start

1. Install a coding-agent runtime such as Claude Code or Codex.
2. Install the `gad` executable from GitHub Releases.
3. Install any GAD skills you want with `npx skills add ...`.
4. Run `gad install all --claude --global` or `gad install all --codex --global`.
5. Start work with `gad snapshot --projectid <id>` or scaffold an eval with `gad eval setup --project <name>`.

Core flow:

```bash
gad snapshot --projectid <id>
gad eval list
gad eval setup --project my-eval
gad eval run --project my-eval --prompt-only --runtime codex
gad eval preserve my-eval v1 --from <worktree>
gad eval verify
gad eval report
```

If snapshot output or SDK skills reference alias paths like `@references/...`,
`@workflows/...`, `@templates/...`, `@agents/...`, or `@hooks/...`, resolve them from the
framework’s canonical SDK asset tree:

- `@references/...` -> `sdk/references/...`
- `@workflows/...` -> `sdk/workflows/...`
- `@templates/...` -> `sdk/templates/...`
- `@agents/...` -> `sdk/agents/...`
- `@hooks/...` -> `sdk/hooks/...`

## Evals

GAD evals are controlled implementation runs with preserved artifacts and scoring data.

Each completed run is designed to preserve:

- `TRACE.json`
- preserved run code
- preserved build output when relevant
- raw `.gad-log` telemetry when available
- runtime identity for the actual agent/runtime that performed the work
- human review

New eval runs also stamp runtime identity and per-run log directories so Claude Code vs Codex
comparisons remain attributable.

## Planning model

GAD is built around a living planning loop rather than one-shot scaffolding.

At a high level:

1. snapshot or inspect project state
2. pick one planned task
3. implement it
4. update planning artifacts
5. preserve evidence when the work is an eval or milestone-worthy step

For GAD’s own framework assets, the canonical authored consumer/runtime content now lives under:

- `sdk/skills`
- `sdk/agents`
- `sdk/workflows`
- `sdk/templates`
- `sdk/hooks`
- `sdk/references`

Runtime-specific wrappers are generated from that source of truth.

## Security

GAD includes defense-in-depth security because planning artifacts and prompts become agent
context.

The shared security module lives in [lib/security.cjs](lib/security.cjs) and covers:

- path traversal prevention for user-supplied paths
- prompt injection scanning
- prompt sanitization
- display sanitization for protocol-leak cleanup
- shell argument validation
- safe JSON parsing
- field and phase validation helpers

The framework also carries a prompt guard hook under `sdk/hooks/gsd-prompt-guard.js`, plus
scanner coverage in:

- `tests/security.test.cjs`
- `tests/prompt-injection-scan.test.cjs`
- `scripts/prompt-injection-scan.sh`

This is defense-in-depth, not a claim of perfect prompt security.

## Release model

- Windows is the authoritative local release build.
- Linux and macOS builds can run in GitHub Actions.
- Only shipped CLI surface changes should trigger a new executable release.
- Skills are distributed from GitHub via `skills.sh`, not through a package registry flow.

Useful commands:

```bash
node scripts/release-should-build.mjs --base HEAD~1 --head HEAD
npm run build:release
node scripts/publish-release.mjs --tag v<version>
```

## Updating

GAD is GitHub-first. Updating depends on how you installed it:

- executable users: download the latest GitHub Release artifact
- source users: pull the repo and rebuild
- runtime assets: re-run `gad install all --<runtime> --global` as needed
- skills: re-run `npx skills add https://github.com/MagicbornStudios/get-anything-done`

## Troubleshooting

If `gad` is not found after install:

- restart your shell so PATH changes are loaded
- verify the executable exists in your install location
- on Windows, check `%LOCALAPPDATA%\Programs\gad\bin\gad.exe`

If runtime assets are missing or stale:

```bash
gad install all --claude --global
gad install all --codex --global
```

If eval verification fails on runtime identity:

- regenerate the run with `gad eval run --runtime <runtime>`
- ensure `GAD_RUNTIME`, `GAD_LOG_DIR`, and `GAD_EVAL_TRACE_DIR` were set for that run

If you are using the source path and hook output looks stale:

```bash
npm run build:hooks
```

## Operator docs

- [Quick Start](docs/quick-start.md)
- [Eval Guide](docs/eval-guide.md)
- [Release Guide](docs/release-guide.md)

## Development

Useful commands for framework development:

```bash
npm test
npm run build:hooks
npm run build:cli
npm run audit:portability
```

## License

MIT - see [LICENSE](LICENSE)
