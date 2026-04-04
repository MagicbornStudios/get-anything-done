<div align="center">

# GET ANYTHING DONE

**A GSD-powered platform layer for spec-driven development at monorepo scale.**

Powered by [get-shit-done-cc](https://github.com/gsd-build/get-shit-done) · Built by [MagicbornStudios](https://github.com/MagicbornStudios)

[![npm version](https://img.shields.io/npm/v/get-anything-done?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-anything-done)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<br>

```bash
npx get-anything-done@latest
```

**Works on Mac, Windows, and Linux. Installs GSD automatically.**

</div>

---

## What is GAD?

**get-anything-done (GAD)** is the platform layer on top of [GSD](https://github.com/gsd-build/get-shit-done).

| GSD | GAD |
|-----|-----|
| One project at a time | Monorepo: N projects, one view |
| `gsd:` commands | `gad:` commands — one prefix, no confusion |
| No extension system | `.gad` domain packs |
| No eval/drift framework | TRACE + SCORE + benchmark runs |
| No docs output | Docs sink → MDX for your docs site |

GAD installs GSD first, then replaces all `gsd:` commands with `gad:`. You get the full GSD planning methodology plus monorepo-scale tooling.

---

## Install

```bash
# Interactive (prompts for runtime + location)
npx get-anything-done@latest

# Claude Code, globally
npx get-anything-done@latest --claude --global

# All runtimes
npx get-anything-done@latest --all --global
```

Installs [get-shit-done-cc](https://github.com/gsd-build/get-shit-done) as a peer dependency, then layers GAD commands on top.

---

## Scaling model

```
Simple (1 repo)    → install GAD, run /gad:new-project, works like GSD
Monorepo           → add [[planning.roots]] entries, gad tasks across all roots
Ecosystem          → .gad domain packs, eval framework, docs sink to portfolio
```

### Simple project (same as GSD)

```bash
npx get-anything-done@latest --claude --global
# In Claude Code:
/gad:new-project
/gad:plan-phase 1
/gad:execute-phase 1
```

### Monorepo — planning-config.toml

```toml
# planning-config.toml (or .planning/planning-config.toml)
[planning]
sprintSize = 5
docs_sink = "apps/docs/content/planning"

[[planning.roots]]
id = "web-app"
path = "apps/web"
planningDir = ".planning"

[[planning.roots]]
id = "api"
path = "apps/api"
planningDir = ".planning"
discover = false
```

Sync from your monorepo automatically:

```bash
/gad:workspace-sync    # crawl repo, add discovered .planning/ dirs
/gad:workspace-show    # show all roots + current phase
/gad:docs-compile      # compile all STATE.md + ROADMAP.md → MDX sink
```

### Ecosystem — .gad packs

Extend GAD for your domain:

```json
// my-pack.gad/gad.json
{
  "name": "manuscript",
  "version": "1.0.0",
  "extends": "get-anything-done",
  "domain": "creative-writing",
  "entry_commands": ["gad:manuscript-new", "gad:manuscript-chapter"]
}
```

---

## Core commands

All GSD commands are available with `gad:` prefix. GAD adds:

| Command | What it does |
|---------|-------------|
| `gad:workspace-sync` | Crawl monorepo, sync `[[planning.roots]]` in toml |
| `gad:workspace-add <path>` | Add a path as a planning root |
| `gad:workspace-show` | Show all roots + current state |
| `gad:docs-compile` | Compile planning docs → MDX sink |
| `gad:migrate-schema` | Convert RP XML files → GAD Markdown |
| `gad:eval-run --project <n>` | Run eval project in git worktree |
| `gad:eval-list` | List eval projects + run history |

Plus all inherited GSD commands: `gad:new-project`, `gad:plan-phase`, `gad:execute-phase`, `gad:autonomous`, `gad:debug`, and more.

---

## Canonical real-world example

This repo IS the portfolio. The portfolio's `.planning/` directory is managed with GAD:

- `planning-config.toml` in `.planning/` registers all vendor project roots
- `gad:docs-compile` writes to `apps/portfolio/content/docs/planning/`
- `evals/portfolio-bare/` is the benchmark eval project

---

## Architecture

```
get-shit-done-cc (peer dep)   ← planning engine, gsd-tools.cjs, hooks
     ↑
get-anything-done             ← platform layer
  commands/gad/               ← gad: slash commands
  bin/gad-config.cjs          ← planning-config.toml reader
  evals/                      ← eval projects
  get-shit-done/              ← runtime tools (from GSD)
```

GAD never forks GSD's runtime — it runs GSD's installer first, then installs GAD's command layer on top. Upstream GSD updates reach GAD users via `npx get-anything-done@latest`.

---

## License

MIT — see [LICENSE](LICENSE)
