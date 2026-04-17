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
powershell -ExecutionPolicy Bypass -File .\install-gad-windows.ps1 -Artifact .\gad-v1.33.0-windows-x64.exe
```

Portable use:

```powershell
.\gad-v1.33.0-windows-x64.exe --help
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

## 5. Start a project and spawn a generation

```bash
gad projects init --projectid <your-project> --name "<Your Project>"
gad species create --project <your-project> --name default
gad snapshot --projectid <your-project>
gad spawn <your-project>/default --prompt-only
```

A **project** is the umbrella (e.g. `escape-the-dungeon`). A **species** is an
evolutionary branch of that project (e.g. `bare`, `emergent`, a test variant).
A **generation** is one build of a species — what `gad spawn` produces.

If snapshot output or SDK skills reference alias paths like `@references/...`,
`@workflows/...`, `@templates/...`, `@agents/...`, or `@hooks/...`, resolve them from the GAD
framework root. Example: `@references/checkpoints.md` → `references/checkpoints.md`.

## 6. Preserve and review generations

```bash
gad generation preserve <your-project> v1 --from <worktree-path>
gad generation verify
gad generation review <your-project> v1 --score 0.7
gad generation report
```

## Key split

- `gad` executable: operational CLI, installed from GitHub Releases
- GAD skills: methodology docs, installed from GitHub with `npx skills add`
- Coding agent runtime: Claude Code, Codex, Cursor, or another supported runtime

## 7. Preview: planning site vs generation build

- **`gad site serve`** — local HTTP server for the **planning / landing** dashboard (Next.js app compiled from your project’s `.planning/`). Not the game or app a generation produced.
- **`gad play <project>/<species>/vN`** (same as **`gad generation open`**) — serves the **preserved static build** (`index.html` + assets), typically after `gad generation preserve`.

See decision **gad-225** in `.planning/DECISIONS.xml`.

