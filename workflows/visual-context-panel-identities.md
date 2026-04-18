# visual-context-panel-identities

Purpose:
Define the identity and prompt-handoff requirements for visual context tooling.

## System requirements

1. Dev-only tooling mode.
2. Fast on/off toggle (visible control + keyboard shortcut).
3. Stable source-searchable identifiers on targetable UI regions.
4. Selection model supports lock/pin (not hover-only).
5. Prompt payload always includes:
- target id
- route
- source-location hint (file path + pattern anchor)
6. Quick prompt actions for CRUD:
- Create
- Read
- Update
- Delete
7. Recorder action copies an update-focused prompt to clipboard.
8. Audio capture can feed into an Update prompt for selected target.
9. Clipboard actions show explicit success/failure acknowledgment.
10. Coverage is app-wide across all in-scope routes/surfaces (not page-scoped only).
11. Developer can always show/hide VCS UI surfaces via explicit dev-mode controls.
12. Disabled mode remains performance-minded for high target/listener/rerender density.

## Identifier pattern requirements

- Use explicit string literals in source.
- Use route-qualified ids to avoid collisions.
- Keep ids stable across refactors when possible.
- Never use runtime-generated ids for user-facing references.

## Snippet examples (generic)

```tsx
<section
  data-vcs-id="dashboard-overview-card"
  data-vcs-anchor="Overview Card"
>
  ...
</section>
```

```tsx
<section
  data-vcs-id="settings-notifications-section"
  data-vcs-anchor="Notifications"
>
  ...
</section>
```

## Prompt payload shape (example)

```txt
target id: dashboard-overview-card
route: /docs/atlas
source file: docs/atlas.html
source hint: pattern anchor: Overview Card
operation: UPDATE
```

## Verification checklist

- Toggle can enable/disable tooling without reload.
- VCS contract is present across all in-scope routes/surfaces.
- Dev-mode controls can explicitly show/hide VCS UI surfaces.
- Disabled mode does not introduce material runtime overhead on dense pages.
- Hover + click lock works and keeps selected target stable.
- Copied id is searchable in source.
- CRUD prompt actions include id + route + source hint.
- Recorder prompt copies successfully.
- Audio-to-update path resolves to selected target.
- Clipboard acknowledgement is visible after every copy action.
