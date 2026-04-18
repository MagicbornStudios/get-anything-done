# visual-context-system

Purpose:
Provide a repeatable behavior spec for visual context tooling in UI projects.

## Core invariant

A user can point at a visible UI region and produce a copy-ready prompt that maps to a stable source identifier.

## Baseline behavior requirements

- Dev-only mode.
- Toggleable overlay/panel.
- App-wide coverage across all in-scope routes/surfaces (not single-page only).
- Explicit dev-mode control can show/hide VCS UI surfaces at any time.
- Disabled mode remains performance-minded for pages with many targets, listeners, and rerenders.
- Stable, searchable ids in source.
- Lockable selection.
- CRUD quick prompt actions.
- Recorder-first update prompt copy.
- Audio-first update entrypoint.
- Clipboard success/failure feedback.
- Prompt payload contains id + route + source hint.

## Workflow A: new implementation

Use when a project has no visual context tooling yet.

Steps:
1. Define in-scope routes/surfaces for app-wide rollout.
2. Add dev-only panel/overlay mount.
3. Add toggle control + keyboard shortcut.
4. Add stable ids to key sections.
5. Add hover + lock selection behavior.
6. Add metadata view (id, route, source hint).
7. Add CRUD quick prompt actions.
8. Add recorder copy action for update prompts.
9. Add audio-to-update prompt path.
10. Add clipboard acknowledgment UI.

Deliverables:
- Working panel/overlay.
- In-scope routes/surfaces are covered by the same VCS contract.
- Copy-ready prompt templates.

## Workflow B: existing implementation hardening

Use when tooling exists but is inconsistent.

Checks:
1. Scan for missing stable ids.
2. Remove runtime-generated ids from user-facing path.
3. Validate route-qualified id naming.
4. Verify lockable selection.
5. Verify CRUD and recorder prompts include full payload.
6. Verify clipboard acknowledgment for all copy actions.
7. Verify coverage is app-wide for all in-scope routes/surfaces.
8. Verify developer can show/hide VCS UI surfaces through explicit dev-mode control.
9. Verify disabled mode remains low-overhead under high target/listener/rerender load.

## Generic snippet examples

```tsx
<button id="vcs-toggle">VCS Off</button>
<div id="vcs-panel" hidden></div>
```

```tsx
<div data-vcs-id="profile-header" data-vcs-anchor="Profile Header">
  ...
</div>
```

```txt
operation: UPDATE
target id: profile-header
route: /app/profile
source file: src/pages/profile.tsx
source hint: pattern anchor: Profile Header
```

## Failure modes

- Overlay cannot be toggled quickly.
- VCS works on one page but is not app-wide across in-scope surfaces.
- No explicit dev-mode hide/show control for VCS UI surfaces.
- Disabled VCS mode still adds noticeable runtime overhead on dense pages.
- Hover-only targeting with no lock/pin.
- Prompts missing route or source hint.
- Clipboard copy has no user feedback.
- Ids are not searchable in source.
