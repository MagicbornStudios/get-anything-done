# Revisit skill creation + proto-skills after VCS findings

**Source:** session 2026-04-17 strategy pivot

Per decision gad-243.

Current VCS implementation is producing findings (compass-neighbor picker was explored and removed 2026-04-16; drag+depth approach queued next). Skill-creation flow and proto-skill mechanics should NOT be reworked until VCS spatial-exploration approach stabilizes — otherwise changes re-churn against moving requirements.

## Revisit triggers

- Drag+depth VCS approach is shipped AND evaluated against the 3-demo showcase spec (gad-232)
- Operator signals VCS requirements are stable for 2+ sessions

## Scope of revisit

- How does an agent propose a new skill mid-session
- Proto-skill → skill graduation criteria (currently gad-86)
- Skill retirement / deprecation mechanics
- Interaction with VCS context collection
