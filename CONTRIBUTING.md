# Contributing to GAD

## Getting started

```bash
git clone https://github.com/MagicbornStudios/get-anything-done.git
cd get-anything-done
npm install
npm test
```

## Development loop

- Use the GAD loop for framework work: `gad snapshot` -> implement -> update planning docs -> commit.
- Keep changes scoped. One logical task per commit.
- Do not rebuild and publish executables for docs-only or site-only changes.

## Tests

```bash
npm test
npm run test:coverage
```

## Release work

Executable release work is only required for shipped CLI surface changes:

- `bin/`
- `lib/`
- `commands/`
- `agents/`
- `.agents/skills/`
- `hooks/`
- `references/`
- `templates/`
- `workflows/`
- release/build scripts
- `package.json` / `package-lock.json`

Check that quickly:

```bash
node scripts/release-should-build.mjs --base HEAD~1 --head HEAD
```

Build the current-platform executable:

```bash
npm run build:release
```

Windows is the authoritative local release build. Linux and macOS builds can run in GitHub
Actions via `.github/workflows/release-posix.yml`.

Publish local artifacts to GitHub Releases:

```bash
node scripts/publish-release.mjs --tag v<version>
```

## Layout

```text
bin/                    Installer and CLI entrypoints
commands/gad/           Runtime skill/command sources
.agents/skills/         Workspace skill catalog
agents/                 Agent definitions
hooks/                  Runtime hooks
references/             Reference docs used by commands/agents
templates/              Planning and workflow templates
workflows/              Workflow docs
scripts/                Build, release, and maintenance scripts
tests/                  Test suite
```
