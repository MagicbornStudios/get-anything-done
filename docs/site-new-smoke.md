# `gad site new` — manual build smoke

Companion to `tests/site-new.smoke.test.cjs`, which only structurally
verifies the generator. This doc covers the full **end-to-end build**
smoke: scaffold a site, install deps, build it, dev-server it. Run
manually any time you change `lib/site-template/files/**`,
`lib/site-template/index.cjs`, or `bin/commands/site.cjs`.

## Prerequisites

- Node 22+
- `pnpm` 9+ available on PATH
- ~5 min, ~300MB free disk (Next.js + Tailwind install graph)

## Steps

```sh
# 1. Stand up a throwaway monorepo skeleton.
mkdir /tmp/gad-smoke && cd /tmp/gad-smoke
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "sites/*"
EOF
cat > package.json <<'EOF'
{ "name": "gad-smoke-host", "version": "0.0.0", "private": true }
EOF

# 2. Scaffold a site. Use your local gad source, NOT the installed binary,
#    so unreleased changes are exercised.
node /path/to/vendor/get-anything-done/bin/gad.cjs site new smoke-site

# Expect:
#   [gad site new] scaffolding smoke-site → /tmp/gad-smoke/sites/smoke-site
#   [pnpm-workspace] no-op (sites/* glob already covers sites/smoke-site)
#   [gad site new] done! N files written

# 3. Install deps from the host repo root.
pnpm install
# Expect: workspace resolves smoke-site cleanly, no peer-dep errors.

# 4. Typecheck + build.
pnpm --filter @gad/site-smoke-site typecheck
pnpm --filter @gad/site-smoke-site build
# Expect: typecheck exits 0; Next.js produces .next/ output.

# 5. Dev server.
pnpm --filter @gad/site-smoke-site dev
# Expect: http://localhost:3000 renders the placeholder homepage.

# 6. Cleanup.
rm -rf /tmp/gad-smoke
```

## Failure triage

| Symptom | Likely cause |
|---|---|
| `pnpm install` errors on `@gad/ui` 404 | Host monorepo missing the workspace package. Either add a `packages/ui` stub or use the `pnpm.overrides` aliasing trick from monorepo CLAUDE.md. |
| `gad-visual-context` not found | Same — workspace dep needs a sibling package. Test only proves the scaffold structure; full install requires the surrounding monorepo. |
| `tsc` complains about strictness | Template tsconfig is `strict: true`; this is the expected baseline. |
| `next build` fails on font / image opt | Likely unrelated — check Next.js 16 release notes. |

For a structural-only check that runs in CI without any of this, use:

```sh
cd vendor/get-anything-done
node --test tests/site-new.smoke.test.cjs
```
