# ROADMAP.xml + REQUIREMENTS.xml audit — 63-15, 63-16

**Date:** 2026-04-20
**Decision:** 2026-04-20 D5 follow-up.

## ROADMAP.xml

**Verdict: KEEP (canonical, actively consumed).**

**Consumers found:**
- `lib/graph-extractor.cjs` — reads phase list for graph nodes.
- `bin/commands/phases.cjs` — list/add operate on it directly; no alternative source.
- `lib/roadmap-reader.cjs` / `lib/roadmap-writer.cjs` — dedicated libs.
- `apps/planning-app/lib/planning-data.ts` — reads for phase UI.
- `vendor/get-anything-done/site/scripts/build-site-data.mjs` — reads for catalog.
- `bin/commands/eval-suite.cjs` — materializes it into species templates.
- `bin/commands/eval-trace/reconstruct.cjs` — reads phase structure for trace reconstruction.

**Why it stays single-file:** 439 lines, low write churn compared to TASK-REGISTRY (2210 lines, high churn). Phases get added rarely, mutated rarely. Multi-agent race risk is minor.

**Future migration (if we ever want it):** phase definitions could move to `.planning/phases/<id>/KICKOFF.md`. ROADMAP.xml could remain as a generated summary, or be retired in favor of graph-extractor producing the summary view. Not urgent.

## REQUIREMENTS.xml

**Verdict: OPTIONAL canonical. Not gated.**

**Consumers found:**
- `bin/commands/projects/shared.cjs` — treats it as a "recommended" file for projects; checks existence.
- `bin/commands/migrate-schema.cjs` — has a legacy XML-to-MD converter (old migration path).
- `bin/commands/eval-suite.cjs` — mentions it in next-action for species templates but doesn't actually write one.
- `apps/planning-app/lib/planning-data.ts` — includes it in the list of XMLs it reads (if present).
- **Not** read by graph-extractor.
- **Not** in the main `gad` CLI flow (no `gad requirements` command).

**Current state in get-anything-done project:** exists at `custom_portfolio/.planning/REQUIREMENTS.xml` (legacy) but is not actively maintained.

**Why it's optional:** no automation depends on it. It's a formal artifact some projects create, others skip. The `specs/` directory and `context-frameworks/` now serve overlapping needs.

**Recommendation:** leave the plumbing in place (no breakage for projects using it), but do not require it for new projects. `projects/shared.cjs` already treats it as recommended, not required — that's the right shape.

## Summary

No action needed for either. Both tasks close with a documentation outcome rather than a code change.

- 63-15 ROADMAP audit → closed (KEEP as-is)
- 63-16 REQUIREMENTS audit → closed (OPTIONAL as-is)
