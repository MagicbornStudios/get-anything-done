# GAD Quick Start

Primary install path: GitHub Release executable. Skills are installed separately through
`skills.sh`.

## 1. Install a coding agent

Pick one:

```bash
# Claude Code
npm install -g @anthropic-ai/claude-code

# OpenAI Codex CLI
npm install -g @openai/codex
```

## 2. Install the GAD executable

Download the current release asset for your platform from GitHub Releases.

Windows global install:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-gad-windows.ps1 -Artifact .\gad-v1.32.0-windows-x64.exe
```

Portable use:

```powershell
.\gad-v1.32.0-windows-x64.exe --help
```

Optional Node/GitHub path if you already have Node:

```bash
git clone https://github.com/MagicbornStudios/get-anything-done.git
cd get-anything-done
npm install
node scripts/build-cli.mjs
node dist/gad.cjs --help
```

## 3. Install skills if you want them

```bash
npx skills add https://github.com/MagicbornStudios/get-anything-done
```

This installs the skill catalog. It does not install the `gad` executable.

## 4. Install GAD into your runtime

```bash
gad install all --codex --global
gad install all --claude --global
```

Use the runtime flags you actually need.

## 5. Start a project or eval

```bash
gad snapshot --projectid <your-project>
gad eval setup --project my-eval
gad eval run --project my-eval --prompt-only
```

## 6. Preserve and review evals

```bash
gad eval preserve my-eval v1 --from <worktree-path>
gad eval verify
gad eval review my-eval v1 --score 0.7
gad eval report
```

## Key split

- `gad` executable: operational CLI, installed from GitHub Releases
- GAD skills: methodology docs, installed from GitHub with `npx skills add`
- Coding agent runtime: Claude Code, Codex, Cursor, or another supported runtime
