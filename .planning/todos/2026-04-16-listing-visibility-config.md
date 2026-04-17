# Project listing visibility config

**Date captured**: 2026-04-16
**Decision**: gad-227
**Related**: gad-189 (draft/published), gad-170 (editor is local-dev)

## The idea

Every public project detail page at `/projects/[...id]` lets the project
owner choose which planning artifacts are visible on the public surface.

## Schema addition

`project.json` gains:

```json
{
  "listingVisibility": {
    "tasks": true,
    "decisions": true,
    "roadmap": true,
    "requirements": true,
    "notes": true,
    "state": true
  }
}
```

All default `true`. Absent field = default.

## Wiring

1. `site/app/projects/[...id]/page.tsx` reads `project.listingVisibility`
   and passes it to `ProjectDetailTabs`.
2. `ProjectDetailTabContent` hides planning sub-tab BUTTONS AND content for
   any artifact where visibility is `false`.
3. Overview and Evolution tabs are always visible (they are not planning
   artifacts per gad-226).
4. System tab visibility: TBD — probably owner-configurable since it exposes
   runtime telemetry.

## Interaction with gad-227 moderation

Moderation overrides owner config. When a project is moderated:

- `published: false` is forced regardless of owner setting.
- Detail page renders a takedown notice instead of content.
- Moderation log records the action + reason.

Moderation tooling is a separate surface (see todo
`2026-04-16-moderation-tooling.md`).

## Not in scope

- Per-sub-tab granularity within an artifact (hide only one specific
  decision, for example). If needed, that's a follow-up.
- Owner auth. First cut writes `listingVisibility` via the dev-only editor.
  Public auth is a later problem.
