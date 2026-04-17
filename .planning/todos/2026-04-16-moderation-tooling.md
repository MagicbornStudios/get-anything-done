# Moderation tooling for public listings

**Date captured**: 2026-04-16
**Decision**: gad-227

## The idea

Platform operators need a surface to takedown, flag, or annotate listings
that are inappropriate, spammy, or otherwise violate platform policy.
Moderation precedes owner visibility config.

## Surface

- Dev-only or admin-role-gated route — `/admin/moderation` or similar.
- Not part of `/projects/edit/*` (owner-facing).
- Lists all registered projects with moderation status + recent actions.

## Actions

- **Takedown** — force `published: false`, hide all tabs, show takedown notice.
- **Flag** — add a warning banner to the public detail page.
- **Unflag / restore** — reverse prior actions.

## Storage

Moderation state lives on `project.json.moderation`:

```json
{
  "moderation": {
    "status": "ok" | "flagged" | "taken_down",
    "history": [
      { "action": "flagged", "reason": "...", "at": "2026-04-16T...", "by": "..." }
    ]
  }
}
```

Missing = `"ok"`.

## Wiring

1. Admin route `/admin/moderation` — lists projects, provides action buttons.
2. Server action writes to `project.json.moderation` (dev-server only).
3. Render-time guard in `/projects/[...id]` checks `moderation.status` first,
   then `published`, then `listingVisibility`.
4. Takedown notice is a new component, not a hacked-together inline.

## Not in scope

- Public reporting flow. Users can email for now; in-UI "report this project"
  is a later add.
- Role management / admin auth. First cut assumes dev-only admin.
- Automated moderation (e.g., banned-word scanning). Manual only for v1.
