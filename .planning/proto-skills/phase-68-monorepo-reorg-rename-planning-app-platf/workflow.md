# monorepo-rename-and-relocate — workflow

When a workspace package needs renaming (e.g.
`@portfolio/planning-app` → `@portfolio/platform`) or relocating
(`apps/portfolio-v2` → `apps/species/portfolio-v2`), the work is
mechanical but error-prone: package.json, every cross-package import,
root scripts, turbo/pnpm config, vendor refs, dev port assignments,
external doc references. Phase 68 shipped 3 such reorgs in one phase.

## When to use

- Renaming a workspace package alongside a directory rename.
- Moving an app under a new parent directory (e.g. `apps/<x>` →
  `apps/species/<x>`).
- Merging marketing surfaces from one app into another while keeping
  the original as a dev/landing surface.

## When NOT to use

- For pure file renames inside a single package (use IDE rename refactor).
- For component renames that don't change package boundaries.
- For URL renames without package or directory changes (use
  `move-route-with-deprecation-stub`).

## Steps

1. Inventory references before any move:
   ```sh
   git grep -l '@portfolio/planning-app'   # package name
   git grep -l 'apps/planning-app'          # path
   ```
   Both lists are the work surface. Compare lengths — equal counts mean
   refs are well-correlated; large skew means refs are ad-hoc.
2. Atomic move:
   ```sh
   git mv apps/planning-app apps/platform
   ```
3. Update package.json:
   - `name: @portfolio/planning-app` → `@portfolio/platform`.
   - Any `bin:` or `scripts:` entries that reference the old name.
4. Replace package-name refs across the monorepo:
   ```sh
   git grep -l '@portfolio/planning-app' | xargs sed -i 's|@portfolio/planning-app|@portfolio/platform|g'
   ```
   Touch: `apps/*`, `packages/*`, `vendor/*`, root `package.json`, turbo
   config, pnpm-workspaces config.
5. Replace path refs that need updating:
   - `apps/planning-app/...` in scripts/configs that hardcode the path.
   - Pnpm-workspace patterns if the parent dir changed (e.g. add
     `apps/species/*` to workspaces).
6. Update root scripts:
   - `gad:planning:*` → `gad:platform:*` (or keep old as aliases for
     muscle memory — decide in-task).
   - `dev:portfolio-v2`, `build:portfolio-v2` filter patterns when the
     package name stays but path changes.
7. Marketing-into-platform merge (per task 68-03):
   - Copy landing/hero/about/pricing surfaces under
     `apps/<platform>/app/(marketing)/*`.
   - Reuse `@portfolio/visual-context` for SiteSection wrappers.
   - Middleware: marketing routes public, platform routes auth-gated.
   - Do NOT delete the original vendor site — it stays as the
     framework's dev/landing site (different audience: framework
     contributors vs platform consumers).
8. Verify:
   - `pnpm install` clean.
   - `pnpm --filter @portfolio/<new> typecheck` passes.
   - `pnpm --filter @portfolio/<new> build` passes if feasible without
     starting Next dev.
9. Dev port: confirm the new package name maps to the same dev port the
   muscle-memory scripts expect (e.g. 3002 for planning-app/platform).

## Guardrails

- Atomic per package. Never half-rename — leaves the workspace in a
  broken state where some refs point at the old name and others at the
  new.
- Use `git mv` not raw `mv + git add` — preserves git history.
- The vendor site stays. `vendor/get-anything-done/site/` is the
  framework's landing site; it's not the platform marketing.
- Aliases for old script names are optional but kind. Document in the
  rename PR if dropped.

## Failure modes

- **Lockfile drift after rename.** `pnpm install` regenerates the
  lockfile; commit the regenerated copy alongside the rename.
- **Imports still resolve to old name.** TypeScript path mapping caches;
  restart the language server after rename.
- **Marketing pages 404 after merge.** Middleware blocks unauth — confirm
  marketing-public list includes the new routes.
- **Original `apps/portfolio-v2` still ghost-builds.** pnpm-workspaces
  pattern still matches both paths. Tighten the pattern.

## Reference

- Decisions gad-261 (overridden by gad-269 → single Next app for
  marketing + platform).
- Phase 68 tasks 68-01, 68-02, 68-03.
- `consolidate-cli-and-routes` skill — for the route-trim half.
- Memory: `feedback_never_mention_portfolio` — apps/portfolio is
  archived; do not reintroduce.
