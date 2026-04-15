---
name: gad-visual-context-panel-identities
description: >-
  Build and maintain source-searchable visual context identities for the GAD site so humans can
  point at what they see, copy exact component/section tokens, and hand off precise update/delete
  prompts to coding agents through the Visual Context Panel.
---

# gad-visual-context-panel-identities

This skill defines the visual context identity system for the site. The goal is simple: when a user
points at a region in the UI, the copied token must map directly to a searchable literal in source.

## When to use

- A user says they cannot find the component they are looking at from the dev/visual panel.
- The panel is copying runtime-generated ids (or unstable values) instead of source literals.
- A section/page shows duplicate panels or inconsistent panel behavior.
- You are adding new sections/pages and need them to be discoverable by name for agent handoff.

## The pattern

1. Use one panel surface only: `DevPanel` in band mode via `BandDevPanel`.
2. Treat `PageIdentified as="..."` as the preferred page-level, human-readable component identity.
3. Give each `SiteSection` a static `cid="..."` literal (or `id="..."` when that id is already stable and intentional).
4. Keep inner landmarks on `Identified as="..."` so list rows map to component-level names.
5. Ensure prompt handoff includes:
   - component kind
   - component label
   - source-search literal (`cid="..."`, `stableCid="..."`, `as="..."`)
   - rendered `data-cid`

## Naming contract

- Page-level region: `PageIdentified as="SkepticHowUsedSection"`
- Section shell: `SiteSection cid="skeptic-how-used-site-section"`
- Inner block: `Identified as="SkepticHowUsedHeading"`

Use explicit literals. Avoid `useId`-suffixed identities for anything users must reference in prompts.

## Canonical snippets

Use these as stable templates when creating or rebuilding sections.

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
  {/* Optional: only when you need deeper row-level targeting */}
  <Identified as="ProjectSkillInheritanceList">
    <ProjectSkillInheritance project={project} />
  </Identified>
</SiteSection>
```

```tsx
<SiteSection cid="skeptic-hypotheses-site-section">
  <Identified as="HypothesesPageIntro">
    <SkepticPageIntro />
  </Identified>
</SiteSection>
```

## Why

The panel is a human-in-the-loop visual CMS context system. Its value is not just highlighting DOM:
it translates what humans see into exact source handles coding agents can act on. Runtime-generated ids
break that bridge because they are not reliably greppable or stable across edits.

## Failure modes

- Duplicate panel surfaces (inside vs outside) create conflicting targets and prompt confusion.
- Auto-generated section ids make copied tokens unsearchable in source.
- Route-level generic ids repeated in one file (`page-site-section` everywhere) create ambiguity.
- Missing `Identified as` landmarks at logical component boundaries reduces edit precision.
- Mermaid render failures can leak raw error text into the page chrome if renderer artifacts are not cleaned.

## Verification checklist

- Hover one section/page band: only one Visual Context Panel appears.
- Copy from panel row/header and `rg` it in repo: token resolves to intended component.
- Update/Delete prompt payload includes route + component kind + search literal + `data-cid`.
- Added sections include explicit static `cid` and meaningful `as` labels.
- Speech/noisy prompt still resolves when route + `cid` are present.

## Cleanup guardrail

For landmark-driven edits:

1. Required cleanup: unused imports and dead local component references.
2. Optional cleanup: deleting unreferenced files created by the exact edit.
3. Avoid wide unrelated refactors in the same pass.

## Planning hook

When this skill is used on a task, record it in planning artifacts:

- `TASK-REGISTRY.xml`: set `skill="gad-visual-context-panel-identities"` on the completed task.
- `STATE.xml`: one line in `next-action` summarizing what ids were normalized — use `gad state set-next-action` (hard cap 600 chars).
- `DECISIONS.xml` (only if policy changed): record the id contract change with examples.

## Related

- `site/components/devid/DevPanel.tsx`
- `site/components/devid/Identified.tsx`
- `site/components/devid/PageIdentified.tsx`
- `site/components/site/SiteSection.tsx`
- `site/components/devid/DevIdAgentPromptDialog.tsx`
