# verify-clean-clone-site-build — workflow

The site build (Vercel, Pages, any deploy target that does a fresh git
clone) only sees what's in the index. Phase 28 found that local
development imports files that exist on disk but were never `git add`ed,
producing module-not-found failures only on production builds. This
skill is the catch-it-locally guard.

## When to use

- Before merging any branch that adds new components or files imported
  across packages.
- After a refactor that introduces new shared imports (e.g. extracting
  a panel into its own file).
- Whenever an agent has touched the site/ tree across multiple files
  in one session.

## When NOT to use

- For pure docs/markdown additions (those are git-only, no build impact).
- For internal lib/ utility files not imported by site routes.

## Steps

1. Establish the clean-clone simulation locally:
   ```sh
   git status --porcelain        # everything must be empty
   git ls-files | grep -E '\.tsx?$' | wc -l   # baseline file count
   ```
   Working tree must be clean before the test — any untracked file
   would mask a missing-from-index bug.
2. From the project root, confirm every imported path resolves to an
   indexed file:
   ```sh
   # for each new/changed file, find what it imports
   grep -nE "^import .* from '\\./|^import .* from '\\.\\./" <file> | \
     awk -F"'" '{print $2}'
   # then verify each path resolves to a file that `git ls-files` knows
   ```
   Anything imported but not in `git ls-files` is a release blocker.
3. Run the production build the deploy target uses, not just dev:
   ```sh
   pnpm --filter <site-pkg> build
   # or the equivalent next build / vite build
   ```
   Local `next dev` can resolve untracked files; `next build` cannot in
   a clean clone.
4. If a missing-import error surfaces, the fix order is:
   - `git add` the missing file (assuming it should ship).
   - Or remove the import (assuming the file is a stub/work-in-progress).
   - Never silence the error by lazy-importing or stubbing in CI.
5. Add a CI gate that runs the production build on a fresh checkout, not
   on the cached working tree. This is the only check that catches the
   bug class.
6. Document the imports-from-shared-pkgs in the package README so the
   next refactor knows what's load-bearing.

## Guardrails

- Never `git add -A` to fix the symptom — it sweeps up unintended files
  (test fixtures, generated artifacts). Add specific paths.
- Vercel-style `outputFileTracingRoot` settings can mask the issue
  during dev — set them only after the clean build is green.
- Generated files (`*.generated.ts`, `dist/`, `data/*.json`) are gitignored
  intentionally; the corresponding generator script must run in the
  build pipeline before the next step. Audit the build's prebuild hook.

## Failure modes

- **Production build passes locally, fails on Vercel.** The Vercel build
  is the clean-clone — local has untracked or stale-cached files.
- **Imports work in `next dev` but not `next build`.** Same root cause —
  the dev server is permissive about path resolution.
- **CI green, prod red.** CI is running on a populated working tree.
  Force `git clean -fdx` before the build step in CI.

## Reference

- `vercel:deployments-cicd` skill — Vercel-specific deploy guard.
- Phase 28 task 28-02 — original surface where this bit production.
- Decision gad-269 (vendor site = marketing only) — narrows what runs in
  the public site build.
