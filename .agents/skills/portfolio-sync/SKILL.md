---
name: portfolio-sync
description: Keep the public-facing get-anything-done landing site at vendor/get-anything-done/site/ in sync with the framework and its evals as they evolve. Trigger this skill whenever an eval run finishes, a new finding is written, a skill/agent/command is added or rewritten, requirements versions change, decisions are captured, or planning state advances. The site reflects the filesystem via a prebuild script — your job is to make sure the filesystem tells the truth and that new surfaces get displayed. This skill is methodology, not a rigid checklist; if you see a better way to organize or refactor the site, take it.
---

# portfolio-sync

The public site at `vendor/get-anything-done/site/` is a statically generated Next.js app that reads directly from the repo at build time. There is no CMS, no database, no API. The source of truth is the filesystem:

| What you changed                                     | Where it lives                                     | How the site picks it up                                       |
|-------------------------------------------------------|----------------------------------------------------|----------------------------------------------------------------|
| New eval run (TRACE.json)                            | `evals/<project>/<version>/TRACE.json`              | `build-site-data.mjs` → `lib/eval-data.generated.ts`           |
| New finding                                          | `evals/FINDINGS-YYYY-MM-DD-slug.md`                 | `build-site-data.mjs` → `FINDINGS` in `catalog.generated.ts` + `/findings/<slug>` route |
| New skill                                            | `skills/<name>/SKILL.md`                            | Scanned into `SKILLS` catalog + `/skills/<name>` detail page   |
| New subagent                                         | `agents/<name>.md`                                  | Scanned into `AGENTS` catalog + `/agents/<name>` detail page   |
| New slash command                                    | `commands/gad/<name>.md`                            | Scanned into `COMMANDS` catalog + `/commands/<name>` detail page |
| Eval template inherits a skill                       | `evals/<project>/template/skills/<skill>.md`        | `SKILL_INHERITANCE` map → shown on `/skills/<name>` and catalog cards |
| New phase or task                                    | `.planning/ROADMAP.xml`, `.planning/TASK-REGISTRY.xml` | `PLANNING_STATE` → `/planning` meta-transparency page         |
| New decision                                         | `.planning/DECISIONS.xml`                           | `PLANNING_STATE.recentDecisions` → `/planning`                 |
| New experiment round                                 | `evals/EXPERIMENT-LOG.md` (append `## Round N`)     | Parsed into `ROUND_SUMMARIES` → Rounds section on home         |
| New requirements version                             | `evals/REQUIREMENTS-VERSIONS.md` (append `## vN`)   | Parsed into `REQUIREMENTS_HISTORY` → Requirements section      |
| New eval project                                     | `evals/<project>/template/` + `evals/<project>/gad.json` | Template zip + planning zip regenerated; add to `Projects.tsx` greenfield/brownfield list manually |
| New game build to publish                            | `evals/<project>/<version>/run/` (Vite source)      | Run `npm run build:games` locally then commit `site/public/playable/<project>/<version>/` |
| Game requirements XML changed                        | `evals/<project>/template/.planning/REQUIREMENTS.xml` | Auto-copied to `public/downloads/requirements/<project>-REQUIREMENTS-v4.xml` |

## When to trigger this skill

- After `gad eval preserve` completes a run → regenerate site data so the new run appears.
- After writing a new FINDING — publishing is a commit, not a ceremony.
- After creating any new skill / agent / command / template — they should show up in the catalog on the next deploy.
- After advancing state in `.planning/` (phase transition, task completion, decision captured) → the `/planning` page exists to make this transparent.
- After a round completes and you want it visible on the home page.

Basically: any time the repo's truth changes and a reader visiting the site today would see a stale version of that truth.

## The sync procedure

**Step 1 — make sure the filesystem is the truth.** Don't hand-edit anything under `site/lib/*.generated.ts` or `site/public/downloads/`. Those files are outputs of `build-site-data.mjs`. If something's wrong on the site, the fix is almost always in `evals/`, `skills/`, `agents/`, `commands/gad/`, or `.planning/`.

**Step 2 — regenerate locally:**

```sh
cd vendor/get-anything-done/site
npm run prebuild        # or: node scripts/build-site-data.mjs
```

This re-zips templates, re-parses traces, re-scans the catalog, re-extracts git history for historical requirements, re-parses STATE/TASKS/DECISIONS, re-renders all markdown bodies to HTML, writes the generated TS files. It's cheap (under 5 seconds) and deterministic.

**Step 3 — build locally to verify:**

```sh
npx next build
```

If type-checking fails, it's almost always because a new TRACE.json has a field the generated interface doesn't allow. Loosen the type in `build-site-data.mjs` (prefer `number | null` + `Record<string, unknown>` intersection over restrictive shapes).

**Step 4 — if you added a new playable game build, run:**

```sh
npm run build:games     # LOCAL ONLY — do not run on Vercel
```

This walks each `evals/<project>/<version>/run/` directory, runs `npx vite build --base ./` so asset URLs are relative (required for subdirectory serving), and copies the result into `public/playable/<project>/<version>/`. Commit these dists — Vercel won't rebuild them.

**Step 5 — commit with a GAD task id** if this is tracked work, or a `chore(site):` prefix if it's a routine sync.

```sh
git add site/lib/catalog.generated.ts site/lib/eval-data.generated.ts site/public/
git commit -m "chore(site): regenerate data after <what changed>"
```

**Step 6 — push.** The submodule commit needs to be pushed to the get-anything-done repo's main branch. Vercel auto-deploys on push. The parent portfolio repo's submodule pointer bump is separate and optional (it only matters if the portfolio needs to reference this submodule state).

## Patterns to follow when the site needs new surfaces

The site is intentionally not finished. As the experiment grows you'll want new sections. When you're considering adding one:

1. **If the data isn't in a generator yet, add the parser first.** New `build-site-data.mjs` section → new fields in `catalog.generated.ts` or `eval-data.generated.ts` → consumed by the page. Keep the generator the bottleneck so everything stays in sync.
2. **New detail pages follow the `DetailShell` pattern.** `components/detail/DetailShell.tsx` handles the chrome (breadcrumb, kind badge, metadata card, rendered body, sidebar, source link). Pass it `kind`, `bodyHtml`, optional `meta` + `sidebar`. Don't reinvent the shell.
3. **New landing sections go under `components/landing/`.** Each section is one file, composed into `app/page.tsx` in whatever order makes the story read. They should be mostly server components; only mark `"use client"` when you need state (selector, search, etc).
4. **SSG over SSR.** Every new dynamic route should export `generateStaticParams` and `dynamicParams = false`. The site is deployed as static HTML — no serverless functions.
5. **Markdown rendering happens at build time via `marked` in the prebuild script.** Don't ship a runtime markdown renderer to the client. Emit `bodyHtml: string` and dump it with `dangerouslySetInnerHTML` inside `.prose-content`.
6. **Refactor when it starts to hurt.** If you're adding the fifth similar landing section and noticing patterns, extract. If a generator function is getting unwieldy, split it. Don't preemptively abstract, but don't let the section list grow to 20 copy-pasted variants either.

## What NOT to do

- **Don't commit generated files by hand.** Always regenerate.
- **Don't add a CMS.** The filesystem is the CMS.
- **Don't require API keys for any part of the public site.** It's a static archive; everything that needs auth lives elsewhere.
- **Don't build the games on Vercel.** 6+ `npm install` + `vite build` calls would balloon the build time. They're pre-built locally and committed.
- **Don't hide the experiment's failure modes.** If a run scored 0 from a human reviewer, the site shows that honestly, side-by-side with the process metrics. The divergence is the point — it's what led to gad-29.
- **Don't create MDX files in the site/content directory.** This site doesn't use MDX content at all (that was the old apps/portfolio/ plan). Content comes from scanning the repo.

## How this skill interacts with others

- `create-skill` — when you write a new skill in `skills/<name>/SKILL.md`, it automatically shows up on the site after the next prebuild + deploy. No separate listing step.
- `find-sprites` — unrelated to site sync, but both are "bootstrap" skills that get inherited into eval templates. If you change which skills are inherited where, the `SKILL_INHERITANCE` map on the site updates to reflect it.
- Any eval skill (`eval-run`, `eval-preserve`, `eval-report`) — finishing a preserve triggers the sync. The run appears on `/runs/<project>/<version>` on the next deploy.
- `plan-phase` / `execute-phase` / `verify-work` — if this work lives in a GAD phase (and it should, per gad-18), the `/planning` page surfaces it automatically. Don't maintain parallel docs.

## Expected cadence

The site should update at the same cadence as experimental progress. If you've done real work and the site looks the same, something's stale. If you're making commits without regenerating, you're drifting.

Treat `npm run prebuild && npx next build` as the equivalent of `gad verify` for the public-facing side of the project.
