---
name: gad-visual-context-identity-audit
description: >-
  Audit and normalize Visual Context Panel identities across the GAD site so every
  user-facing section has a source-searchable `cid` literal. Use when the user reports
  "I copied a token from the panel and cannot grep it", after adding new routes/sections,
  or when rolling out the explicit-cid pattern across a batch of existing sections
  (the phase 44 follow-up pattern). Runs as a pass, not an invention —
  the identity policy itself lives in `gad-visual-context-panel-identities`.
source_phase: "44"
source_evolution: 2026-04-14-001
status: proto
---

# gad-visual-context-identity-audit

This is the **rollout/audit** companion to `gad-visual-context-panel-identities`. The
parent skill defines the contract ("use explicit `cid` literals, not runtime ids").
This skill is how you systematically apply that contract to an existing codebase.

## When to use

- User says "I copied a token from the dev panel and can't find it in source" — that's
  a runtime-id leak. Audit the route they were on.
- You're closing out task `44-16` or any similar "normalize remaining sections" work.
- A new route landed without the explicit-cid pattern and the review wants it backfilled.
- A batch PR introduces multiple `SiteSection` components without `cid` literals.

## Pre-read

- `vendor/get-anything-done/references/visual-context-panel-methodology.md` — the
  canonical snippets + planning usage contract.
- `vendor/get-anything-done/skills/gad-visual-context-panel-identities/SKILL.md` — the
  identity policy itself. This audit skill enforces that policy; it does not redefine it.

## Steps

1. **Scan for runtime-id leaks.** Grep the site tree for `SiteSection` calls without a
   `cid=` prop — these are the leak sources:
   ```sh
   grep -rn "SiteSection" site/ --include="*.tsx" | grep -v 'cid='
   ```
   Each hit is a candidate. Filter out list-comprehension renderers (they typically
   get their cid from a parent loop variable).

2. **Classify each hit.** For each candidate:
   - Is it a page-level shell? → wrap in `PageIdentified as="..."`.
   - Is it a repeating row inside a list? → skip; rows inherit from the parent section.
   - Is it a content section? → add `cid="<kebab-route>-<kebab-section>-site-section"`.

3. **Pick a naming convention and stick to it.** Prefer `<route>-<section>-site-section`
   literals (e.g. `project-hero-section-site-section`). Never use `useId()` output or
   any value interpolated at render time — the whole point is greppability.

4. **Add inner `Identified as="..."` landmarks** only for sub-regions a user would
   plausibly want to target individually (heading, intro, action row). Don't carpet
   the tree.

5. **Verify by grep.** For every token you added, run `rg "<token>" site/` and confirm
   exactly one hit. Zero hits means a typo; multiple hits means ambiguity.

6. **Open the dev panel** (dev server), hover each affected section, click the token,
   and paste-search it in your editor. One cheap manual pass catches 90% of regressions
   that grep alone misses (e.g. tokens wrapped in template literals).

7. **Update planning:**
   - `TASK-REGISTRY.xml`: mark the relevant task `status="done" skill="gad-visual-context-identity-audit"`.
   - `STATE.xml` `next-action`: one line listing which routes were normalized.
   - `DECISIONS.xml`: only touch if the contract itself changed — this skill's job is
     enforcement, not policy drift.

## Failure modes

- **Normalizing list rows.** Don't. Rows inherit from the parent section's `cid`;
  adding per-row literals makes the source search noisy and defeats the pattern.
- **Copy-paste literal collisions.** Two sections with the same `cid` on different
  routes break "one grep → one hit". Always include the route slug in the literal.
- **Removing stable `id=` in favor of new `cid=` on elements that already had stable
  anchors.** If the existing `id=` is already stable, the parent skill allows using
  it as-is. Don't churn working code.
- **Normalizing inside dynamic/generated content** (markdown-rendered MDX, findings
  pages rendered from data). Those regions intentionally don't carry dev-panel
  identities because the content is data, not source.

## Reference

- `site/components/site/SiteSection.tsx` — the component that accepts `cid`
- `site/components/devid/Identified.tsx`
- `site/components/devid/PageIdentified.tsx`
- `site/components/devid/DevPanel.tsx` — the panel surface reading the tokens
- `vendor/get-anything-done/references/visual-context-panel-methodology.md`

## Related

- `gad-visual-context-panel-identities` — the policy this audit enforces
- Task `44-16` — the canonical driving task for this skill's first run
