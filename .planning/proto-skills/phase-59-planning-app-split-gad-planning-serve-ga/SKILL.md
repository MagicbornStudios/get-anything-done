---
name: split-planning-app-from-marketing
description: >-
  Extract operator-facing surfaces (project editor, BYOK, /my-projects)
  out of a marketing/landing app into a separate Next app, build the
  `gad planning serve` + `gad start` CLI launcher, wire daily-subagent
  dispatch, deprecate the original routes. Use when a public site has
  accreted operator-only routes that need an auth boundary, or when the
  daily-subagent loop needs a stable host.
status: proto
workflow: ./workflow.md
---

# split-planning-app-from-marketing

Marketing surfaces and operator surfaces have different release cadences,
audit posture, and auth requirements. Phase 59 enforced the boundary
(decision gad-269) by scaffolding `apps/planning-app` and porting the
operator-facing routes out, leaving the landing app to focus on public
content. The CLI launcher (`gad planning serve` / `gad start`) then
made the operator app addressable as a daily entry point.

This skill is the migration recipe + the launcher contract. The
landing-app deprecation stubs are the easiest part to forget — without
them, internal cross-links 404 silently.

**Workflow:** [./workflow.md](./workflow.md)

## Provenance

- Source candidate: `.planning/candidates/phase-59-planning-app-split-gad-planning-serve-ga/CANDIDATE.md`
- Drafted: 2026-04-28 by `create-proto-skill`
- See [PROVENANCE.md](./PROVENANCE.md)
