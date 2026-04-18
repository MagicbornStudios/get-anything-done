# scaffold-visual-context-surface

Purpose:
Scaffold a new UI surface with visual context tooling before feature work.

## Required outcome before feature work

- Dev-only and toggleable visual context tools are active.
- Surface has stable searchable ids.
- Selection can be locked.
- CRUD quick prompts are available.
- Recorder update prompt copy works.
- Audio-to-update path is defined.
- Clipboard acknowledgement is visible.

## Step-by-step

1. Gate the surface to dev mode.
2. Add visible toggle and keyboard shortcut.
3. Define section id map (explicit string literals).
4. Add ids to surface sections.
5. Implement hover + lock selection.
6. Show selected metadata (id, route, source hint).
7. Add CRUD quick prompt actions.
8. Add recorder update prompt action.
9. Add audio capture to update prompt path.
10. Add clipboard success/failure messaging.
11. Run one full round trip from selected section to copied update prompt.

## Section id requirements

- Explicit literals in source.
- Route-qualified naming.
- Deterministic id families for repeated rows.
- Include one literal prototype comment for generated patterns.

## Snippet examples

```tsx
// id prototype: orders-row-<order-id>
<div data-vcs-id={`orders-row-${order.id}`} data-vcs-anchor="Orders Row">
  ...
</div>
```

```txt
Recorder prompt
operation: UPDATE
target id: orders-row-123
route: /app/orders
source file: src/pages/orders.tsx
source hint: pattern anchor: Orders Row
```

## Acceptance checklist

- [ ] Toggle works without reload.
- [ ] Selected target remains locked until unlocked.
- [ ] Copied id is searchable in source.
- [ ] CRUD actions generate copy-ready prompts.
- [ ] Recorder copies update prompt.
- [ ] Audio capture maps to selected target update prompt.
- [ ] Clipboard feedback appears for success and failure.

## Common failures

- Building feature UI before context tooling baseline is complete.
- Using runtime-generated ids for user-facing targeting.
- Missing route/source hint in copied prompts.
- No explicit feedback after clipboard actions.
