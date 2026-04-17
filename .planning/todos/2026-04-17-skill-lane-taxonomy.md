# Catalog existing skills into DEV vs PROD before phase 55

**Source:** session 2026-04-17 strategy pivot

Per decision gad-247 + phase 55.

Before adding lane: frontmatter to every SKILL.md, produce a catalog classification:

## Scope

- Every skill under vendor/get-anything-done/skills/
- Every skill under skills/ at repo root

## Output

- Table per skill: slug / current description / proposed lane(s) / rationale
- Skills that span BOTH lanes get flagged for split or explicit dual-tag
- Skills that fit NEITHER lane get flagged for possible deprecation

## Open questions

- debug — DEV or both?
- verify-phase — DEV (build-time QA) or PROD (release-time QA) or both?
- create-skill — DEV (tooling for building) or META (framework itself)?
- Does META need to be a third lane?
