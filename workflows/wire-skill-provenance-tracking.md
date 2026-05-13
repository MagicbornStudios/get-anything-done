# wire-skill-provenance-tracking — workflow

When a generation produces or consumes skills, the provenance trail
needs to survive into the preserved artifact. Phase 31 wired snapshot
diffing (start vs end) into the eval-preserve step so site UI can
display installed/inherited/authored badges per generation.

## When to use

- A new eval/generation system is being added that needs to track
  which skills were live at run time.
- Site UI needs to surface skill-author attribution on a per-run page.
- Adding a new skill source (framework / installed / authored) and the
  badge taxonomy needs to extend.

## When NOT to use

- For one-off skill installations (use `gad install` directly).
- For skill creation (that's `create-skill` / `gad-skill-creator`).

## Steps

1. Identify the snapshot capture point. The eval pipeline already records
   `skills_provenance.start_snapshot`. Capture an end_snapshot at run
   completion using the same shape (see `lib/snapshot-equipped-skills.cjs`).
2. Compute the diff:
   - **inherited**: present at both start and end, unchanged.
   - **installed**: present at start, modified by end (rare; flag).
   - **authored**: present at end, absent from start (the new ones the
     generation produced).
3. Write the diff into the run's TRACE.json under `skills_authored: []`
   so downstream UI can read it without recomputing.
4. Site rendering: badge palette per decision gad-31:
   - installed → blue
   - inherited → green
   - authored → amber
   - framework_skill: true → violet "Framework"
5. Wire `gad create-skill` (or `gad-create-skill`) so it mandates
   `gad eval setup --project` as a step in the skill-creation workflow.
   That binds new skills to a verifying eval before they enter the
   catalog.
6. Add the framework-skill flag: skills with `framework_skill: true` in
   SKILL.md frontmatter render the violet badge. Pre-existing skills
   without the flag default to authored/inherited classification.

## Guardrails

- The provenance shape is an artifact contract. Changing field names is
  a breaking change to every preserved run that ships them.
- Skills modified in place between start and end should never silently
  become "authored" — flag them as a separate "modified" class or fail
  the eval (depending on operator policy).
- Badge colors are operator-facing — don't reuse them for other
  classifications.

## Failure modes

- **Diff misses authored skills** because skill-discovery scanned the
  wrong dir at end. Confirm the end snapshot uses the same root
  resolution as the start snapshot (cwd-walk vs project-root explicit).
- **Inherited skills mis-flagged as installed** when the runtime mutates
  SKILL.md mtime without changing content. Hash content, not mtime.
- **Site shows badges with no skill data** — the run was preserved
  before the diff was computed. Run order must be: capture end →
  compute diff → preserve.

## Reference

- Decision gad-31 (badge palette).
- `lib/snapshot-equipped-skills.cjs`, `lib/proto-skill-helpers.cjs`.
- `gad-evolution-validator` — runs after this skill in the evolution
  pipeline.
- Phase 31 tasks 31-01..31-04.
