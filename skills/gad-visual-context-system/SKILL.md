---
name: gad-visual-context-system
description: >-
  Build and maintain a UX pattern for visual-context identity in any app where a coding
  agent needs to act on "the thing I'm pointing at". The skill has two workflows —
  one for bringing the system into a project that doesn't have it yet (design/spec),
  and one for enforcing/extending the system in a project that already has it
  (maintenance/rollout). Use when a user says "I can't find the component I'm
  looking at", "we need a dev panel", "hook up the visual context system in
  <new app/game>", or "normalize the ids across <existing app>".
source_phase: "44"
source_evolution: 2026-04-14-001
status: proto
parent_skill: gad-visual-context-panel-identities
---

# gad-visual-context-system

A **UX pattern for visual-context-building during software development with
coding agents.** The value is not the DOM highlighting — it's the bridge
between *what a human sees in the UI* and *what a coding agent can unambiguously
act on from source*.

The skill has **one entrypoint** and **two workflows**, chosen by the shape of
the project it's running in.

## Core invariant (both workflows)

Every user-facing region has a **source-searchable identity literal** — a token
that appears verbatim in a source file and can be found with plain `grep`. No
runtime-generated ids. No template-literal concatenation that only exists after
render. No `useId()` for anything the user is meant to reference.

The three landmark kinds:

- **Section shell** — `SiteSection cid="<route>-<section>-site-section"` (stable literal).
- **Inner landmark** — `Identified as="<ComponentName>"` for targets more specific than the section shell (heading, row, action).
- **Page wrapper (optional)** — only when a page has multiple sections that share a
  single dev-panel band. See **PageIdentified caveat** below.

The hand-off payload a coding agent receives must carry:
component kind + component label + source-search literal + rendered `data-cid`
+ route. This is what makes the copy-paste loop work.

## Which workflow to run

Determine which workflow you need by reading the project configuration first:

```sh
# From the repo root of the project the user is working on:
node vendor/get-anything-done/bin/gad.cjs projects audit 2>&1 | head -40
ls <project>/src/components 2>/dev/null   # or equivalent component root
grep -rn "SiteSection\|Identified as=\|data-cid" <project>/src 2>&1 | head -20
```

- **No hits** and no dev panel component → **Workflow A: Design & Build**.
- **Existing system + some sections missing `cid` literals** → **Workflow B: Maintain & Rollout**.
- **Existing system + every section clean** → nothing to do; check if the skill
  needs to evolve (new landmark kinds, new copy-paste affordances).

Both workflows share the core invariant above. They differ in what they produce.

---

## Workflow A: Design & Build (greenfield / new project)

Use this when spinning up the visual-context system in a project that has no
dev panel, no identity literals, and no copy-paste handoff path.

This is the common case for **game projects** and any app the user hasn't
touched yet. At the start of Workflow A you do **not** yet know the specific
components/sections — the skill's job is to give the user a working system they
can extend as the UI takes shape.

### Steps

1. **Design the three landmark components** for the target app's component
   framework. Use the existing GAD-site implementations as canonical reference
   (see **References** below). In React/JSX the shapes are:
   - `SiteSection` — wraps a section, accepts `cid: string`, writes `data-cid`, `data-cid-component-tag="SiteSection"` to the DOM root.
   - `Identified` — generic wrapper, accepts `as: string`, same data attrs with `"Identified"` tag.
   - `DevPanel` — a floating/band overlay that queries the DOM for those attrs, shows the token on hover, supports click-to-copy and open-in-agent-prompt.

   Non-React targets (Unity, Godot, game engines): the invariant still holds —
   the literal needs to be written somewhere `grep` finds it. For Unity UGUI
   that could be an attribute on the prefab; for a canvas-based renderer it
   could be a string constant on the component class.

2. **Ship the minimal `DevPanel` surface** — one panel, gated to `NODE_ENV=development` (or engine-dev-build equivalent). Start with: hover highlight, click-to-copy, copy-with-agent-prompt affordance. No nesting, no section-vs-band duality — that was the 2026-04-14 regression, avoid it.

3. **Write the agent-prompt handoff payload** as a single shared component. It must emit: route + component kind + component label + source-search literal + `data-cid`. See `DevIdAgentPromptDialog.tsx` for the canonical shape.

4. **Seed one landmark per major section** so the user has something to grep against on day one. Don't try to achieve full coverage in Workflow A — the user will drive that as the UI grows.

5. **Leave Workflow B plumbed in** — add a one-line script (or CI check) that can be run later to grep for `SiteSection` without `cid=` and fail-with-report. This is the handoff to Workflow B.

### Deliverables

- `components/devid/{DevPanel,Identified,SiteSection,DevIdAgentPromptDialog}.tsx` (or the app's equivalent paths)
- Dev-only mount of `DevPanel` in the root layout
- One seeded landmark in at least the home route
- The Workflow B audit script stub

### Failure modes

- **Shipping the panel before the invariant is enforced.** Users copy tokens,
  `grep` finds nothing, trust collapses. Seed at least one literal before the
  panel is visible.
- **Using runtime-generated ids for landmarks** because it's "temporary". It's
  never temporary. Always start with literal strings.
- **Splitting the panel into section-mode vs band-mode up front.** Single
  surface wins. Complexity can be added later if there's real demand; the
  duality regression is expensive to undo.

---

## Workflow B: Maintain & Rollout (existing project)

Use this when the system already exists in the project and the user reports
one of: "I copied a token from the dev panel and can't find it in source", a
new route landed without the explicit-cid pattern, or a batch PR introduced
multiple `SiteSection` components without `cid` literals. The canonical example
is the GAD site itself (`vendor/get-anything-done/site/`).

### Steps

1. **Scan for runtime-id leaks** from the repo root:
   ```sh
   grep -rn "SiteSection" <site-root>/app <site-root>/components --include="*.tsx" | grep -v 'cid='
   ```
   Each hit is a candidate. Filter out loop renderers — they inherit from a
   parent section.

2. **Classify each hit:**
   - Page shell with multiple sections → normally a `SiteSection cid="<route>-page-site-section"` is enough. `PageIdentified` is **deprecated** — prefer a top-level `SiteSection` with a route-qualified literal.
   - Content section → `cid="<route>-<section>-site-section"`.
   - Repeating row inside a list → **skip**, rows inherit from the parent section.

3. **Name convention** — always include the route slug. `page-site-section`
   alone is banned because it collides across routes. Use
   `<route>-<section>-site-section` or `<route>-page-site-section`.

4. **Add inner `Identified as="..."` landmarks** only where a user would plausibly
   target the sub-region (heading, intro, action row). Don't carpet the tree.

5. **Verify by grep** — one token, one hit. Zero hits = typo. Multiple hits = ambiguity.

6. **Manual pass in the dev panel** — hover each affected section, click the
   token, paste-search in the editor. Catches regressions `grep` misses (tokens
   wrapped in template literals).

7. **Update planning artifacts** on the project you're working on:
   - `TASK-REGISTRY.xml`: mark the task `status="done" skill="gad-visual-context-system"`.
   - `STATE.xml` `next-action`: one line listing the normalized routes — use `gad state set-next-action` (hard cap 600 chars).
   - `DECISIONS.xml`: only if the policy itself changed. This workflow enforces, it doesn't drift.

### Failure modes

- **Normalizing list rows.** Rows inherit; adding per-row literals makes grep noisy and defeats the pattern.
- **Copy-paste literal collisions** — two sections with the same `cid` on different routes. Always include the route slug.
- **Removing stable `id=` anchors** in favor of new `cid=`. If the existing `id=` is already stable, allow both: `id="workflow" cid="workflow-site-section"`.
- **Auto-replace gone wrong.** The 2026-04-14 rollout had a bad sed pass that character-substituted `c → i` across page files (`SiteSeition`, `iomponents`). If you're doing a batch rename, run it **one file at a time** with reads before and after, or use the Edit tool with an explicit old/new match rather than a regex.
- **Normalizing inside dynamic/generated MDX or data-rendered content.** Don't. Those regions are data, not source.

---

## PageIdentified caveat (both workflows)

`PageIdentified` was an earlier page-level wrapper component. As of 2026-04-14
it has exactly **one remaining call site** (`app/skeptic/page.tsx`) in the GAD
site and is scheduled for removal. For any new Workflow A project, **do not
implement a `PageIdentified` component** — a top-level `SiteSection cid="<route>-page-site-section"`
covers the same ground with less surface area. For Workflow B on a project
that still has `PageIdentified`, replacing call sites is a quick migration;
see the file list in **References**.

## Related patterns

- **Multi-project monorepos** — when the skill runs from the monorepo root and
  the operator has multiple projects with their own `gad-config.toml` scope,
  Workflow B needs to know which project's `site/app/` to scan. Read
  `planning-config.toml` / `gad-config.toml` first and scope by the project the
  user is currently on.
- **CI guard** — a repo-level script that fails CI when a `SiteSection` lacks
  `cid=` or uses a banned generic literal (`page-site-section`). Mentioned as a
  follow-up in the 44-16 rollout notes.

## References (GAD site — canonical Workflow B target)

- `vendor/get-anything-done/site/components/site/SiteSection.tsx` — section shell
- `vendor/get-anything-done/site/components/devid/Identified.tsx` — inner landmark
- `vendor/get-anything-done/site/components/devid/DevPanel.tsx` — panel surface
- `vendor/get-anything-done/site/components/devid/DevIdAgentPromptDialog.tsx` — handoff dialog
- `vendor/get-anything-done/site/components/devid/SectionRegistry.tsx` — registry of component kinds
- `vendor/get-anything-done/skills/gad-visual-context-panel-identities/SKILL.md` — the existing policy-only skill this proto-skill extends/supersedes
- `vendor/get-anything-done/references/visual-context-panel-methodology.md` — durable methodology doc (phase 44-17)

## Relationship to parent skill

The existing `gad-visual-context-panel-identities` skill in `skills/` is **the
policy-only contract** for the GAD site. This proto-skill **supersedes** it by
adding Workflow A (design/build in a new project) on top of the same invariant.
On promotion, consider either:

- **Promote and deprecate parent** — this skill fully contains the parent's
  content. Parent moves to `skills/.archive/` or is deleted.
- **Promote as sibling** — parent remains the canonical GAD-site policy, this
  skill becomes the meta/multi-project version. Higher surface area, clearer
  separation.

Recommendation: **promote and deprecate parent**. The policy lives in this
skill's Workflow B section; the parent file adds no information the new skill
doesn't.
