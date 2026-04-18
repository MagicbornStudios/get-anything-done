---
id: h-2026-04-18T21-10-49-get-anything-done-63
projectid: get-anything-done
phase: 63
task_id: narrative-soul-linter
created_at: 2026-04-18T21:10:49.098Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: normal
estimated_context: reasoning
runtime_preference: opencode
---
# Narrative + soul linter — opencode first-run task

Mirror of `lib/skill-linter.cjs` shape. New files only. Provisional opencode lane row landed in `references/agent-lanes.md` as of 2026-04-18 — your allow set is intentionally small until this handoff closes cleanly.

## Before you start

1. Read `CLAUDE.md` at repo root, then `vendor/get-anything-done/references/agent-lanes.md` (your row is "opencode (provisional)").
2. Read `vendor/get-anything-done/lib/skill-linter.cjs` end-to-end — this is the reference shape.
3. Read `vendor/get-anything-done/references/skill-shape.md` — analogous contract doc for skills.
4. Read `vendor/get-anything-done/projects/magicborn/narrative/` — only existing narrative tree; use to derive shape.
5. Read `vendor/get-anything-done/SOUL.md` (or repo-root `SOUL.md`) — only existing soul artifact, derive contract from it.

Run on session open: `gad startup --projectid get-anything-done` then `gad handoffs claim <this-id>`.

## Deliverable

Three files, all NEW:

### (a) `vendor/get-anything-done/references/narrative-shape.md`

Contract doc for narrative bundles. Define required sections, naming convention for files in `projects/<p>/narrative/`, frontmatter fields if any, what makes a narrative "complete enough to be entered via `gad narrative enter <p>`".

### (b) `vendor/get-anything-done/references/soul-shape.md`

Contract doc for `SOUL.md` files. Define required sections (Issue/Carry/Return/Reconcile per Kael's structure is the existing example), the soul-name field, link-to-narrative pointer, the assignment surface (`~/.claude/gad-user.json` `assignedSouls` map per `references/agent-lanes.md`).

### (c) `vendor/get-anything-done/lib/narrative-linter.cjs`

Validator. Same shape as `lib/skill-linter.cjs`:

- Exports `lintNarrative(path) -> { issues: [{severity, code, message, file, line?}] }`
- Exports `lintSoul(path) -> { ... same shape ... }`
- Exports `lintAllNarratives(repoRoot) -> { byProject: { [pid]: { narrative: ..., soul: ... } } }`
- Severity levels: `error`, `warn`, `info` (mirror skill-linter)
- Non-blocking (caller decides exit code)
- No new deps — stdlib only

### (d) `vendor/get-anything-done/tests/narrative-linter.test.cjs`

Per-rule fixture tests under `tests/fixtures/narrative-linter/` (you create the fixture tree). Cover: missing required section, malformed frontmatter, valid narrative passes clean, valid soul passes clean.

## What you do NOT touch

Per provisional opencode lane row (see `references/agent-lanes.md`):

- ANY file under `bin/`
- ANY file under `lib/` except the new `narrative-linter.cjs`
- `lib/snapshot-*`, `lib/handoffs.cjs`, `lib/runtime-*`, `lib/secrets-*`
- `apps/**`, `site/**`
- Any existing `SKILL.md`, any existing `STATE.xml` / `TASK-REGISTRY.xml` / `ROADMAP.xml`
- Other agents' `.planning/notes/` files (create your own if needed)

If you discover the linter NEEDS to call into existing snapshot or handoff libs, **stop and file a handoff back instead** — do not edit those.

## Acceptance

- `node vendor/get-anything-done/lib/narrative-linter.cjs` (or whatever entry shape skill-linter uses) runs against `projects/magicborn/narrative/` and `SOUL.md`, reports clean (or honest issues if real).
- `vendor/get-anything-done/tests/narrative-linter.test.cjs` runs green via the existing test runner the repo uses (check `package.json` scripts).
- Two contract docs (`narrative-shape.md`, `soul-shape.md`) are concrete, falsifiable, ≤1 page each. Don't over-specify.
- Zero changes outside the four files listed above.

## When done

`gad handoffs complete <this-id>`. Post:

- The four file paths you wrote (so claude can register them in claude-lane reads)
- Any contract decisions you made that should become DECISIONS.xml entries (file via `gad decisions add`)
- One-liner: did the existing magicborn narrative + SOUL.md pass clean, or did the linter surface issues worth fixing?

## Lane widening

After this lands clean, your allow set widens to: validation utilities (`lib/*-linter.cjs` family), narrative-related references, narrative-related tests. Editor surfaces and runtime libs stay denied until further proven.

## Signed
— Kael of Tarro / claude-code, 2026-04-18 fleet-startup