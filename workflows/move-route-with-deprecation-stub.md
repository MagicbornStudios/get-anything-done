# move-route-with-deprecation-stub — workflow

When a route moves between apps in a monorepo (e.g. vendor site
`/project-market` → platform app `/marketplace`), the old location
needs a deprecation stub that tells inbound traffic where the route
moved + how to run the new host. Phase 70 shipped this as 3 tasks:
move + import rewrite, deprecation stub, env-driven URL helper.

## When to use

- A single route or small route family is moving from one app/host to
  another in a monorepo.
- Inbound traffic (bookmarks, internal cross-links, external docs)
  needs a soft landing.
- The new host runs on a different port/URL that should be configurable
  per-environment.

## When NOT to use

- For renaming a route within the same app (use a redirect).
- For deleting a route entirely (just delete + 404).
- For app-level reorgs (use `monorepo-rename-and-relocate`).

## Steps

1. Inventory the move:
   - Pages to move (e.g. `page.tsx` + sibling components).
   - Component imports that go with them.
   - Lib reads (e.g. `eval-data.ts`, `project-config.ts`).
   - Sibling `@/` aliases that need rewriting to absolute or new aliases.
2. Move files:
   ```sh
   git mv vendor/.../app/project-market apps/platform/app/marketplace
   git mv vendor/.../components/project-market apps/platform/components/marketplace
   ```
3. Rewrite imports:
   - `@/components/site` → `@gad-site/components/site` (or platform
     equivalent for SiteSection moved to `@portfolio/visual-context`).
   - `@/lib/eval-data` → `@gad-site/lib/eval-data`.
   - Sibling `@/components/project-market/*` → `@/components/marketplace/*`
     (since the dir was renamed in the move).
   - `cn` helper → `@/lib/cn` if the platform app uses a different
     util location.
4. Drop dev-only / vendor-coupled components that don't belong in the
   new host (e.g. `DevCatalogBanner` from a vendor site shouldn't move
   to a public platform app).
5. AppShell + nav update:
   - Add the new route entry to the platform app's nav.
   - Confirm middleware status (public vs auth-gated) matches the move
     decision.
6. CTA + cross-link rewrites:
   - Public-facing CTA targets (e.g. `PlayableTeaser` "explore" button)
     point at the new URL.
   - First cut can hardcode `http://localhost:<port>/<route>`; record a
     TODO to switch to env-driven helper.
7. Deprecation stub at the old location (per task 70-02):
   - Replace the moved page.tsx with a server-rendered deprecation
     message: "The marketplace has moved to the platform app."
   - Include install + run CLI snippet:
     `pnpm --filter @portfolio/<new-host> dev`.
   - Link to the new URL.
   - Match the pattern of other deprecation stubs in the source app.
   - No component imports — single file, server-only.
8. Env-driven URL helper (per task 70-03):
   - `NEXT_PUBLIC_PLATFORM_URL` (or equivalent) read at build time.
   - Helper function `getPlatformUrl()` returns the env value with a
     localhost default.
   - Replace the hardcoded URL from step 6.
9. Update TASK-REGISTRY (or `.planning/tasks/<id>.json`) for any tasks
   that referenced the old route as their target.

## Guardrails

- Deprecation stub is server-rendered, not client. The old route serves
  HTML even when the platform app is down — bookmarks need a deterministic
  response.
- Env helper has a sensible default (e.g. `http://localhost:3002`) so
  local dev works without env config.
- Cross-link rewrites are exhaustive — `git grep '/project-market'`
  must return zero results in `apps/` after the move.
- Vendor site's deprecation stub stays for one release cycle, then can
  be removed.

## Failure modes

- **Imports fail to resolve in new host** — TypeScript path mapping
  needs an entry for the new alias (e.g. `@gad-site/*`). Add to
  `tsconfig.json` paths.
- **Deprecation stub redirects in a loop** — if the new host points
  back at the old URL via env default, the stub loops. Use absolute
  URLs in the stub message.
- **Middleware blocks public marketplace** — new route has to be in
  the public allow-list, not the protected list.
- **`PlayableTeaser` CTA still points at old URL** — local override or
  cached build. Run the env helper through every CTA, not just one.

## Reference

- Decision gad-269 (vendor site = marketing only, platform = operator).
- Phase 70 tasks 70-01, 70-02, 70-03.
- `monorepo-rename-and-relocate` skill — for app-level moves.
- `consolidate-cli-and-routes` skill — for bigger restructuring.
- `split-planning-app-from-marketing` skill — sibling for the
  app-split-followed-by-route-move case.
