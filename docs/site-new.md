# `gad site new <slug>` — generator workflow

Scaffolds a new Next.js 16 + Tailwind v4 site under `sites/<slug>` in
the host monorepo, wires it into pnpm-workspace, seeds GAD planning,
and (optionally) provisions the GitHub repo + Vercel project.

## What it does

| Step | Output |
|---|---|
| 1. Template copy | Every `*.tmpl` in `vendor/get-anything-done/lib/site-template/files/` is rendered into `sites/<slug>/`. Binary files (images, fonts) copy as-is. |
| 2. Placeholder substitution | Mustache-style `{{slug}}` is replaced with the new slug throughout every text file (see `lib/site-template/index.cjs` → `applySubstitutions`). |
| 3. `.env.example` normalization | Generated `.env.example` includes the three canonical placeholders — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key-here>`, `CLERK_SECRET_KEY=<your-clerk-secret-key-here>`, `AI_GATEWAY_API_KEY=<your-ai-gateway-key-here>` — plus blank-default optionals (Supabase, Anthropic). See task 84-04. |
| 4. `pnpm-workspace.yaml` update | If the host's `pnpm-workspace.yaml` doesn't already cover `sites/<slug>` via a `- "sites/*"` glob or explicit entry, the generator appends `- "sites/<slug>"` under the `packages:` block. Idempotent: re-running on an already-covered slug is a no-op. See task 84-03. |
| 5. `.planning/` seed | A minimal planning directory is seeded with `PROJECT.md`, `ROADMAP.xml` (one starter phase), and `DECISIONS.xml` (empty `<decisions>` root). The full set of XML files is filled in lazily by other `gad` commands (`gad tasks add`, `gad decisions add`, etc.). See task 84-03. |

## Usage

```sh
# Standard scaffold.
gad site new acme

# Preview without writing.
gad site new acme --dry-run

# Pick a non-default target dir.
gad site new acme --target-dir /tmp/scratch/acme

# Clone an existing site as a template instead of using the built-in.
gad site new acme --template 7greens
```

## Optional follow-ups

After the scaffold runs, the generator prints next-step instructions
for the manual flow. The flags below collapse those into one command:

```sh
# Provision the GitHub repo (runs `gh repo create`).
gad site new acme --gh-init --gh-org my-org

# Link the new directory to a Vercel project (runs `vercel link`).
gad site new acme --vercel-link --vercel-team my-team

# Combine them.
gad site new acme --gh-init --gh-org my-org --vercel-link
```

After the Vercel project is linked, attach a custom domain with:

```sh
gad site link --slug acme --domain acme.example.com
# With redirect:
gad site link --slug acme --domain acme.example.com --redirect www
```

`gad site link` uses `VERCEL_TOKEN` if set; otherwise it prints the
manual `vercel domains add` / `vercel alias set` commands.

## Smoke paths

| Path | When to run |
|---|---|
| `node --test vendor/get-anything-done/tests/site-new.smoke.test.cjs` | Every change to the generator. Structural-only — runs in ~500ms with no network. |
| Manual full build smoke — see [`site-new-smoke.md`](./site-new-smoke.md) | Before tagging a release that touches `lib/site-template/`. Stands up a throwaway monorepo, installs deps, builds, runs dev server. |

## Maintenance expectations

### Adding a new template file

1. Add the source under `lib/site-template/files/<rel-path>.tmpl` (or
   without the `.tmpl` suffix if it's binary).
2. Add an `assert.ok(fs.existsSync(...))` line to
   `tests/site-new.smoke.test.cjs` so the test enforces it exists.
3. Run `node --test tests/site-new.smoke.test.cjs`. Commit.

### Adding a new placeholder

The generator currently only substitutes `{{slug}}`. To add e.g.
`{{author}}` or `{{vercelTeam}}`:

1. Thread the new value through `generateSite({ slug, ... })` in
   `lib/site-template/index.cjs`.
2. Update `applySubstitutions` to also replace the new token.
3. Add a regression test in `tests/site-new.smoke.test.cjs`.

### When NOT to extend this generator

- Per-project custom commands → use `.planning/commands/` instead
  (see decision GLOBAL-D-344 in the host monorepo CLAUDE.md).
- Operator-specific deploy automation → keep it in the host
  monorepo's `scripts/`, not in the generator.
- One-off prototyping templates → use `--template <existing-slug>`
  to clone an existing site rather than mutating the canonical
  template.

## Related files

- `vendor/get-anything-done/bin/commands/site.cjs` — CLI plumbing
- `vendor/get-anything-done/lib/site-template/index.cjs` — generator core
- `vendor/get-anything-done/lib/site-template/files/` — template tree
- `vendor/get-anything-done/tests/site-new.smoke.test.cjs` — structural smoke
- `vendor/get-anything-done/docs/site-new-smoke.md` — manual build smoke
