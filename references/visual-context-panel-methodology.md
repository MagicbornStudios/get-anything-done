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

## Planning usage contract

When this methodology is applied in implementation work:

1. Tag the task with the skill used:
   - `skill="gad-visual-context-panel-identities"`
2. Add one concise line in `STATE.xml` next-action summarizing what was normalized.
3. Add a decision entry only when policy changes (not for routine rollout).
4. Keep examples current in:
   - `skills/gad-visual-context-panel-identities/SKILL.md`
   - this references document

## Related assets

- `skills/gad-visual-context-panel-identities/SKILL.md`
- `.planning/DECISIONS.xml` (`gad-186`, `gad-187`)
- `site/components/devid/DevPanel.tsx`
- `site/components/devid/DevIdAgentPromptDialog.tsx`
