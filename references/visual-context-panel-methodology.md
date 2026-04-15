# Visual Context Panel Methodology

## Purpose

This document defines the stable human-in-the-loop workflow for visual editing handoff.
It is framework-agnostic: whatever UI stack you use, operators must be able to point at
what they see, copy a stable identifier, grep it in source, and hand a precise prompt to
a coding agent.

## Core contract

1. Section-level identity is explicit and source-searchable.
2. Panel copy payload includes route, component kind, label, search literal, and data-cid.
3. Only one panel surface is maintained to avoid split semantics.
4. Runtime-generated ids are never the primary handoff token.

## Portal modals (Radix Dialog)

Dialogs render outside the `<section>` DOM but still participate in the **same** band scan:

1. `SiteSection` provides `DevIdBandProvider` with this section’s band `cid`.
2. `DialogContent` sets `data-devid-band="<same cid>"` (from context or explicit `devIdBandCid` prop).
3. The band `DevPanel` merges open nodes `[data-devid-band=…][data-state=open]` (Radix dialog content; do not rely on `role="dialog"` matching the same element) into the section’s landmark list so inner `<Identified>` targets appear while the modal is open.

Use `devIdBandCid={null}` on `DialogContent` when a dialog must not attach to any section scan.

## Component identity model

1. Page landmark:
   - `PageIdentified as="ProjectPage"`
2. Section shell:
   - `SiteSection cid="project-hero-section-site-section"`
3. Optional inner landmark:
   - `Identified as="ProjectHeroActions"`

Use the smallest identity that still gives precise editing scope.

## Canonical examples

```tsx
<PageIdentified as="ProjectPage">
  <SiteSection cid="project-hero-section-site-section">
    <SiteSectionHeading title={project.name} />
  </SiteSection>
</PageIdentified>
```

```tsx
<SiteSection cid="project-skills-scope-section-site-section" tone="muted">
  <SiteSectionHeading title="Skill Scope" />
  <ProjectSkillInheritance project={project} />
</SiteSection>
```

```tsx
<SiteSection cid="skeptic-hypotheses-site-section">
  <Identified as="HypothesesPageIntro">
    <SkepticPageIntro />
  </Identified>
</SiteSection>
```

## Prompt handoff shape

Use this structure when copying context for an Update/Delete prompt:

1. `component_route_location`
2. `Component kind`
3. `Component label`
4. Search literal (for grep)
5. Rendered `data-cid`
6. Requested change

## Fast input mode (speech + loose UPDATE)

This workflow supports noisy, speech-to-text prompts as long as landmarks are present.
The operator does not need perfect component hierarchy language if the prompt includes:

1. Route URL
2. Landmark token (`cid` preferred)
3. Intent verb (`UPDATE`, `DELETE`, etc.)

Example resilient input:

- "On `/gad`, remove `gad-skill-bootstrap-section-site-section`"
- "Footer area has Mermaid syntax error text pushing layout"

Agent requirement: resolve by landmark first, then verify nearest parent route component.

## Planning usage contract

When this methodology is applied in implementation work:

1. Tag the task with the skill used:
   - `skill="gad-visual-context-panel-identities"`
2. Add one concise line in `STATE.xml` next-action summarizing what was normalized.
3. Add a decision entry only when policy changes (not for routine rollout).
4. Keep examples current in:
   - `skills/gad-visual-context-panel-identities/SKILL.md`
   - this references document

## Cleanup boundary policy

Landmark-driven edits should default to targeted cleanup:

1. Always remove unused imports caused by the edit.
2. Remove now-unreferenced component files only when they are clearly dead.
3. Do not broad-refactor unrelated sections during a landmark operation.
4. Typecheck the touched package and report pre-existing failures separately.

This keeps "delete/update by landmark" fast and predictable while still preventing obvious drift.

## Automation + scale note

Manual landmark authoring (`cid` literals) is labor intensive, but it provides high-precision
control for human-in-the-loop development. Future automation should preserve this contract:

1. Auto-generated scaffolds may propose ids, but final ids must remain source-searchable literals.
2. Any abstraction that hides landmarks must still expose stable copy tokens to operators.
3. Reusability patterns are acceptable only if they do not remove route + landmark traceability.

## Related assets

- `skills/gad-visual-context-panel-identities/SKILL.md`
- `.planning/DECISIONS.xml` (`gad-186`, `gad-187`)
- `site/components/devid/DevPanel.tsx`
- `site/components/devid/DevIdAgentPromptDialog.tsx`
