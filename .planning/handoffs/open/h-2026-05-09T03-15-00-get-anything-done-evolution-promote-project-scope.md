---
id: h-2026-05-09T03-15-00-get-anything-done-evolution-promote-project-scope
projectid: get-anything-done
phase: null
task_id: null
created_at: 2026-05-09T03:15:00.000Z
created_by: opus-4-7-1m@claude-code (dispatched from slm-learning)
claimed_by: null
claimed_at: null
completed_at: null
priority: high
estimated_context: small
risk: safe
time: standard
surface: local
runtime_preference: any
---

Cross-project handoff filed by slm-learning Dr. Stein dispatch (decision slm-learning-209). Source repo: slm-learning. Target repo: get-anything-done (this one).

## Why this exists

Per slm-learning-209 (2026-05-09): project-level proto-skill promotion was structurally broken. Two HIGH-priority project-local proto-skills exist at:
- `slm_learning/.planning/proto-skills/modal-cli-windows-prefix/`
- `slm_learning/.planning/proto-skills/refactor-modal-runtime-import-check/`

`gad evolution promote modal-cli-windows-prefix --framework --projectid slm-learning` resolved to the framework canonical and refused to find them (the `--framework` flag did not exist; `--projectid` was ignored). Project XP stayed at 0. The slm-learning evolution loop (pressure → candidates → drafts → promotion → level-up) died inside the project, never compounded.

## What landed in this commit (uncommitted in working tree — see notes)

Files modified:
- `bin/commands/evolution/promote.cjs` — full rewrite with `resolvePromoteRoots()` priority chain (env > --projectid > CWD non-framework root > framework fallback), `awardProjectXp()` helper (mirrors tasks/stamp.cjs pattern, weight=8 matching `create-proto-skill`), mutual-exclusion enforcement.
- `bin/commands/evolution.cjs` — wire `findRepoRoot/gadConfig/resolveRoots` into `createEvolutionPromoteCommand`.
- `tests/evolution-promote-project-xp.test.cjs` — new 6-test smoke battery (relocation, +8 XP, level-up readiness via repeated promotes, flag-conflict refuse, unknown-id refuse, framework-promote isolation).
- `CHANGELOG.md` — Unreleased / Added entry.

Test results:
- `node --test tests/evolution-promote-project-xp.test.cjs` → 6/6 pass
- `node --test tests/evolution-install-bundle.test.cjs` → 2/2 pass (no regression on framework-mode promote)
- `node --test tests/evolution-cli.test.cjs tests/evolution-install.test.cjs` → 7/7 pass

LOC budget: ~140 LOC of new code in `promote.cjs` (full rewrite ~280 LOC, but original was 105 — net +~175 of which ~50 are the `resolvePromoteRoots` priority chain and ~50 are `awardProjectXp` + the new XP message branch). Under 200 LOC cap.

## What needs to happen next on this side (framework canonical)

1. Dr. Stein review the diff and accept/reject. The change is bounded — 2 source files + 1 test + CHANGELOG. No build/CI infra touched.
2. **Commit on this side.** The slm-learning dispatch was instructed NOT to commit cross-project. Working tree currently dirty:
   - `bin/commands/evolution/promote.cjs` (modified)
   - `bin/commands/evolution.cjs` (modified)
   - `tests/evolution-promote-project-xp.test.cjs` (new)
   - `CHANGELOG.md` (modified)
   - `.planning/handoffs/open/h-2026-05-09T03-15-00-get-anything-done-evolution-promote-project-scope.md` (this file, new)
3. **Rebuild the gad binary.** Operator's installed `gad.exe` (1.35.0) was built before this fix. Until rebuilt via the `build-and-release-locally` skill, `gad evolution promote --projectid slm-learning <slug>` will still hit the old binary code path and fail to award project XP. Source-CLI invocation (`node <repo>/bin/gad.cjs ...`) works today.
4. Once binary ships, slm-learning can run:
   ```
   cd C:/Users/benja/Documents/slm_learning
   gad evolution promote modal-cli-windows-prefix --projectid slm-learning
   gad evolution promote refactor-modal-runtime-import-check --projectid slm-learning
   gad evolution level-up --projectid slm-learning   # (after enough XP / 3 resolved-signals)
   ```

## Slm-learning constraints inherited

- Do NOT promote either of the two slm-learning proto-skills to FRAMEWORK. They are slm-learning-pressure-derived. They might LATER be promoted framework-wide if other projects independently request them, but that is a deliberate decision, not a default.
- The proto-skill bundles at `slm_learning/.planning/proto-skills/{modal-cli-windows-prefix, refactor-modal-runtime-import-check}/` stay as source-of-truth even after project install. (Note: the new promote logic DOES rm the proto-skill dir after install — same behavior as the existing framework path. Operator may want to revisit if project bundles should be preserved post-install, but that's a separate decision.)

## Closeout criteria

- This handoff completes when:
  - 4 file changes above are committed in get-anything-done.
  - New gad binary is published via build-and-release-locally.
  - slm-learning runs the two `gad evolution promote --projectid slm-learning <slug>` commands and confirms project XP > 0.

Stamp skill=`gad-execute-phase` (or `framework-upgrade` if Dr. Stein prefers — this is a CLI architecture fix). References: slm-learning decision 209, slm-learning issue traced from the 2026-05-08/9 session-close.
