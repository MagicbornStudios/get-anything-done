# scaffold-visual-context-surface — workflow

The procedure an agent follows when scaffolding a new dev-only UI surface
(editor, inspector, admin pane, modal stack) under the Visual Context
System mandate.

## Why this exists

Every new GUI surface in this repo must ship with complete Visual Context
coverage: stable `cid`s on every interactive element, Visual Context Panel
identities registered, and at least one modal-footer CRUD prompt
round-tripping against a real cid *before* any feature affordance goes in.
Skipping the scaffolding-first discipline produces surfaces that are
invisible to the Visual Context Panel and ungrep-able — and the
retrofitting cost is much higher than doing it right the first time
(decisions gad-186 + gad-187, and the 2026-04-15 Visual Context feedback
memory).

This workflow is the checklist. Follow it in order. Do not build any
editor affordance (drag-drop, inline editors, data wiring) until every
step is green.

## Step 1 — gate the surface

Add the route or pane under a `NODE_ENV === 'development'` guard at
module-load time. Show a visible "(dev mode)" badge in the surface itself
so the operator can see the gate is active.

```tsx
if (process.env.NODE_ENV !== 'development') {
  return <NotFoundInProduction />;
}
```

The gate is non-negotiable even when the surface is "obviously" safe —
the Project Editor command bridge (phase 44.5-02) learned this the hard
way. Reject prod at the boundary so a wide-open dev surface can never
ship.

## Step 2 — enumerate panes and assign cids

Before writing any JSX, list every distinct region of the surface:

- Each viewport pane (left/right/bottom in a split view)
- Each toolbar, header, footer
- Each interactive element group (button clusters, form sections)
- Each row/card/slot primitive that will eventually be virtualized

For each, write down a **kebab-case cid** following the naming contract:

```
<surface-name>-<region>-site-section
project-editor-bestiary-pane-site-section
project-editor-preview-pane-site-section
project-editor-inspector-pane-site-section
recipe-crud-list-site-section
```

The cid is the identity. Everything downstream grep-searches on it.
Source-searchable literal — not a computed string, not a template var.

## Step 3 — emit cids as literals

Every element in the list gets an explicit `<SiteSection cid="..."/>`
wrapping literal in the JSX. The cid **must** be a bare string literal so
global search (`grep "recipe-crud-list-site-section"`) finds it. Computed
cids break the discovery chain and fail the mandate.

For deterministic cid families (one per row, one per slot), derive them
from the row's stable identity (slug, key path) — not its index:

```tsx
// YES: stable on species slug
<SiteSection cid={`bestiary-card-${species.slug}-site-section` as const} />

// NO: stable on array position
<SiteSection cid={`bestiary-card-${index}-site-section`} />
```

When a cid family is derived, also emit a **prototype literal** in a
comment nearby so `grep` still finds an example:

```tsx
// cid prototype: bestiary-card-<species-slug>-site-section
```

## Step 4 — register identities in the Visual Context Panel

Run the identity registration step. For each cid, ensure:

- The Visual Context Panel picks up the section (dev-id band scan)
- The modal footer CRUD form can target it
- The section shows up in the dev panel's compact view

Check with the real dev panel, not by inspection. The registration path
is owned by `gad-visual-context-panel-identities`; read that skill's
workflow once for the registration CLI surface.

## Step 5 — round-trip one prompt BEFORE feature work

Mandatory gate before writing any feature affordance: pick one cid from
the surface, open the modal footer CRUD form against it, submit a prompt,
and confirm the round-trip produces the expected update in the source
tree. This is the "at least one prompt from the visual-context-modal-footer
round-trips against a pane cid" acceptance from phase 44.5-01.

If the round-trip fails, **do not build features**. Fix the wiring first:

- Cid literal not discoverable? → Step 3 cid is computed, not literal.
- Modal footer can't target the cid? → Step 4 registration incomplete.
- Prompt goes through but nothing updates? → Visual Context Panel route
  not wired to the backing data source.

The round-trip is load-bearing proof that downstream feature work will
have a working CRUD surface instead of an inert one.

## Step 6 — only now build features

With the scaffold + cid coverage + round-trip green, feature work begins.
Every new interactive element added from this point also follows steps 3
and 4 (literal cid + registration) — drift is how surfaces decay out of
the Visual Context System.

Acceptance for the scaffold phase (step 6 entry gate):

- [ ] Dev gate rejects prod at module load
- [ ] Every pane emits a literal cid
- [ ] Every cid registered with the Visual Context Panel
- [ ] At least one modal-footer CRUD round-trip green
- [ ] Dev-panel badge visible
- [ ] tsc clean

## Failure modes

- **Cid is a computed string.** Grep can't find it. Rewrite as a literal
  or add a prototype-literal comment alongside the computed version.
- **Feature work started before the round-trip.** Stop. Finish step 5
  first. The round-trip is cheaper to fix against an empty scaffold than
  against a scaffold with half-built features.
- **Dev gate added "later".** Added late means a window existed where the
  surface could ship to prod. Revert and reland with the gate at the
  top of the module.
- **"Just one" unregistered element.** Becomes five. Becomes twenty.
  Register at the moment of introduction, not at a "cleanup pass" later.
- **Cid families without prototype comments.** Future agents searching
  for an example of the pattern find nothing. Always leave one
  literal-string reference grep can find.

## Related

- `gad-visual-context-panel-identities` — identity registration mechanics
- Decision gad-186 — dev-panel copy tokens must be source-searchable
- Decision gad-187 — Visual Context Panel naming contract (cid first)
- Phase 44.5 task 44.5-01 — the scaffold-first task that drove this skill
- Feedback memory `feedback_visual_context_system_mandatory.md` (2026-04-15)
