---
phase: 66
title: CLI hygiene
status: in-progress
lead: claude-opus
runtime: claude-code
opened: 2026-04-22
session-window: 2026-04-22
---

# Phase 66 — CLI hygiene

## Expanded goal (post 2026-04-22 session)

The original phase 66 was narrow: fix the v1.35.0 loader-bundling regression, split `gad self build` vs `gad self install`, add a pre-commit build hook, delete the SEA pipeline, embed src-hash for staleness.

This session expands the scope to absorb three adjacent cleanups that share the "hygiene" theme:

1. **XML retirement (63-53).** Per-task JSON at `.planning/tasks/<id>.json` becomes the sole source of truth for the task registry. `TASK-REGISTRY.xml` is retired from dual-write; the reader falls back to XML read-only with a migration nudge.
2. **OMX kill (gad-282 / gad-283 / gad-284).** `.omx/` disappears as a top-level surface; all state consolidates under `.planning/` with GAD branding and no per-runtime privileges. `gad-config.toml` remains the sole config surface.
3. **Stale doc sweep (63-47).** SEA and npx references are removed from all bin/, scripts/, skills/, workflows/, references/, and CLAUDE.md files. Done.

The new phase goal:

> Ship a single clean CLI surface. Loader bundling works under Bun compile. Build and install are distinct verbs. State lives in `.planning/`. Config lives in `gad-config.toml`. Tasks live in per-task JSON. Docs are current.

## What shipped this session (2026-04-22)

| Task | Status | What shipped |
| --- | --- | --- |
| 63-47 | done | SEA + npx references swept from the repo. |
| 63-54 | done | `gad graph build` help text updated; other stale "XML files" strings audited. |
| 63-45 | done | `gad tasks update` extended with `--phase`, `--type`, `--status`, `--depends`, `--append-goal`. `update.cjs` rewritten to JSON-only. Test suite `tests/tasks-update-goal.test.cjs` expanded from 2 → 6 test cases. |
| 63-53 | done | XML dual-write retired across `add.cjs`, `update.cjs`, `promote.cjs`, and `lib/agent-lanes.cjs`. Reader prefers per-task JSON, falls back to read-only XML parse with operator nudge. `vendor/get-anything-done/.planning/TASK-REGISTRY.xml` and root `.planning/TASK-REGISTRY.xml` deleted (both at 100% JSON coverage before removal). Test fixtures across `parser-coverage`, `tasks-release-skill-reject`, `task-attribution`, `snapshot-agent-lanes`, `evolution-cli` migrated from XML to per-task JSON. `lib/skill-usage-stats.cjs` extended to read JSON tasks first. CLAUDE.md XML guidance replaced. 88 task-related tests green. |
| gad-282 design | design only | OMX kill plan written at `.planning/notes/2026-04-22-omx-kill-plan.md` (global scope). Plan does not execute — operator reviews before any `.omx/` move. |

## What remains

| Task | Status | Notes |
| --- | --- | --- |
| Loader bundling (original 66 goal) | planned | Not started this session. Build manifest at `bin/commands/_manifest.cjs` still a stub. |
| `gad self build` / `gad self install` split | planned | Not started this session. |
| Pre-commit build hook | planned | Not started this session. |
| `scripts/build-release.mjs` deletion | planned | SEA pipeline still present on disk. |
| Src-hash staleness stamp on built exe | planned | Not started this session. |
| OMX kill execution | blocked-on-review | Plan written; awaits operator signoff before execution. Touches `vendor/claw-code/vendor/oh-my-codex/`. |
| `gad team` mailbox OMX-free | partial | Mailbox already writes to `.planning/team/` (63-02). Full decoupling depends on OMX kill. |

## Success criteria

- All `gad tasks add/update/stamp/promote` calls write JSON only. **Met.**
- `TASK-REGISTRY.xml` absent from vendor + global projects. **Met.**
- CLAUDE.md no longer instructs agents to hand-edit XML. **Met.**
- `gad tasks update --help` shows `--phase / --type / --status / --depends / --append-goal / --goal / --append-goal`. **Met.**
- `.omx/` kill plan exists. **Met.**
- `.omx/` actually removed from monorepo. **Not met — intentional, needs operator signoff.**
- Loader bundling regression fixed. **Not met — out of scope for this session.**
- Build/install verbs split. **Not met — out of scope for this session.**

## References

- Decisions: gad-282 (kill OMX), gad-283 (gad-config.toml sole config), gad-284 (no per-runtime privileges), 2026-04-20 D3 (per-task JSON canonical).
- Session note: `.planning/notes/2026-04-22-omx-kill-plan.md`.
- Commits (this session): to be listed post-commit.
- Tasks reassigned from phase 63 → phase 66: 63-45, 63-47, 63-53, 63-54.
