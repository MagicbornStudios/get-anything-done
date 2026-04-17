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

## 7. Preview: planning site vs generation **artifact**

- **`gad site serve`** — local HTTP server for the **planning / marketing** Next dashboard (from your project’s `.planning/`). This is the GAD “site” product surface — not a generation’s game/app output.
- **`gad play <project>/<species>/vN`** (same as **`gad generation open`**) — HTTP preview of the **preserved build artifact** (folder with `index.html`), usually after `gad generation preserve`. Add **`--no-browser`** to print the URL for an iframe (editor preview) instead of opening the system browser.

See decision **gad-225** in `.planning/DECISIONS.xml`.

## 8. Run the GAD marketing site (monorepo / clone)

The Next.js app source is in **`site/`** at the framework root (same tree as `bin/gad.cjs`). You always have the source when you have the repo or submodule.

**Static planning preview (matches what you ship as static HTML):**

```bash
# From a project that has .planning/ (example: framework itself)
cd vendor/get-anything-done
node bin/gad.cjs site serve --projectid get-anything-done
# Listens on port 3456 by default (dev). Generation previews use different ports (gad play).
```

**Packaged / consumer profile** (different default port so you can run it next to dev):

```bash
gad site serve --consumer
# default port 3780 unless you set GAD_SITE_SERVE_PORT or pass --port
```

**Live Next dev (edit `site/` with hot reload):** `cd site && pnpm install && pnpm dev` from the framework root (requires Node + install in `site/`).

**Parent monorepo (e.g. `custom_portfolio` with `vendor/get-anything-done`):** add `vendor/get-anything-done/site` to the parent `pnpm-workspace.yaml`, then from the **parent repo root** run `pnpm install`, `pnpm gad:site:dev`, and `pnpm gad:site:serve` — see the parent `AGENTS.md` (GAD marketing site table).

