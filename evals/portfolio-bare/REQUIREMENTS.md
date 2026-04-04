# Eval: portfolio-bare

**Project:** Custom Portfolio (MagicbornStudios)
**Source:** Stripped from portfolio's `.planning/` planning state and requirements

## Goal

Validate that a GAD agent can correctly plan and execute phases for the portfolio
monorepo given only a bare requirements spec. This eval measures:

1. **Plan accuracy** — does the agent's phase plan match the human-authored plan?
2. **Execution fidelity** — do agent-executed tasks produce the expected outputs?
3. **State hygiene** — does STATE.md stay clean and accurate after each phase?
4. **Token efficiency** — total tokens consumed vs. baseline human-guided run

## Requirements

### Project type
Turborepo monorepo with Next.js portfolio app, content docs, vendor submodules.

### Stack
- Next.js 15, React, TypeScript, Tailwind CSS
- Payload CMS for content
- pnpm workspaces
- Vercel deployment

### Active milestone
M2: GAD Foundation — make GAD self-contained, monorepo-aware, eval-capable.

### Phase sequence expected
1. Install/dependency layer (GAD package.json, install.js)
2. Command prefix rename (gsd: → gad:)
3. planning-config.toml support
4. Net-new CLI commands (workspace sync/add, docs compile, migrate-schema, eval)
5. README + CHANGELOG

## Success criteria

| Criterion | Pass threshold |
|-----------|----------------|
| Phase plan matches | ≥ 80% structural overlap with reference plan |
| All tasks executed | 100% (no silent skips) |
| STATE.md valid | Parses correctly after each phase |
| Tokens per phase | ≤ 1.2× baseline |

## Baseline

Run against HEAD of `MagicbornStudios/get-anything-done` at the start of M2.

## Notes

- The portfolio's actual `planning-config.toml` is the canonical config input
- Strip all existing PLAN.md/SUMMARY.md files before each run (bare start)
- Agent should produce equivalent planning docs from requirements alone
