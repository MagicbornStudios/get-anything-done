# GET ANYTHING DONE

GAD is an operational CLI and eval framework for coding-agent workflows. It is not a coding
agent runtime by itself. You run GAD alongside Claude Code, Codex, and the other supported
runtimes.

## Install

Primary path: GitHub Release executable.

- Download the latest `gad-v<version>-windows-x64.exe`, `gad-v<version>-linux-<arch>`, or
  `gad-v<version>-macos-<arch>` asset from GitHub Releases.
- Windows: either run it portably, or install it globally:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-gad-windows.ps1 -Artifact .\gad-v1.32.0-windows-x64.exe
```

Or from the packaged executable itself:

```powershell
.\gad-v1.32.0-windows-x64.exe install self
```

Optional Node/GitHub path: use a GitHub checkout if you already have Node.

```bash
git clone https://github.com/MagicbornStudios/get-anything-done.git
cd get-anything-done
npm install
node scripts/build-cli.mjs
node dist/gad.cjs --help
```

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

## Quick start

1. Install a coding-agent runtime such as Claude Code or Codex.
2. Install the `gad` executable from GitHub Releases.
3. Install any GAD skills you want with `npx skills add ...`.
4. Run `gad install all --codex --global` or the matching runtime flags.
5. Start work with `gad snapshot --projectid <id>` or scaffold an eval with `gad eval setup --project <name>`.

## Core commands

```bash
gad snapshot --projectid <id>
gad eval list
gad eval setup --project my-eval
gad eval run --project my-eval --prompt-only
gad eval preserve my-eval v1 --from <worktree>
gad eval report
```

## Release model

- Windows is the authoritative local release build.
- Linux and macOS builds can run in GitHub Actions.
- Only shipped CLI surface changes require a new executable release.
- Skills are distributed from GitHub via `skills.sh`, not bundled into a package registry flow.

Operator docs:

- [Quick Start](docs/quick-start.md)
- [Eval Guide](docs/eval-guide.md)
- [Release Guide](docs/release-guide.md)

## License

MIT - see [LICENSE](LICENSE)
