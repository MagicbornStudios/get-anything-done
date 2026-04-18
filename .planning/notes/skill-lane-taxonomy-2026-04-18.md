# Skill lane taxonomy — DEV vs PROD vs META catalog

**Date**: 2026-04-18
**Author**: claude-code (default agent)
**Closes todo**: `2026-04-17-skill-lane-taxonomy.md`
**Decisions referenced**: gad-247 (DEV vs PROD lanes), phase 55 (lane frontmatter rollout)
**Scope**: every `vendor/get-anything-done/skills/*/SKILL.md` (91 skills). Root `skills/` is empty of SKILL.md files (canonical location is the vendor tree per `skills/README.md`).

## Lane definitions

Per gad-247:

| Lane | Definition | Rough analogy |
|---|---|---|
| `dev` | Building the thing — ideation, plan, code, debug, test, assets, iteration | What an engineering team does Monday–Friday |
| `prod` | Shipping the thing to users — packaging, distribution, marketing copy, SEO, billing, moderation, onboarding, support, analytics, compliance | What a launch/ops team does the week of release |
| `meta` *(proposed)* | Building the framework that builds the thing — skill creation, skill evolution, eval harness, framework upgrade, trace analysis | What a tools/devex team does |

**Recommendation: adopt `meta` as a third lane.** ~22 of the 91 skills are squarely about the framework operating on itself (create-skill, evolution loop, eval harness, snapshot optimisation). Forcing them into `dev` makes the dev catalog noisy when a project author is just trying to find "how do I build my thing?" — they don't want skill-creation methodology in their default load. A separate `meta` lane lets `gad skill list --lane dev` stay focused on "build my product"; `--lane meta` is what framework contributors filter to.

If `meta` is rejected, all skills currently classified `meta` collapse into `dev` (none of them ship product to end users).

## Counts

| Lane | Count | Notes |
|---|---|---|
| `dev` | 60 | Build-the-product skills (planning, execute, debug, ideation, write-doc) |
| `meta` | 22 | Framework-on-framework (skill creation, evolution, eval harness, framework upgrade) |
| `prod` | 3 | Shipping/marketing (build-and-release, portfolio-sync, evolution-images-as-marketing) |
| `dev+prod` (dual-tag) | 4 | Apply at both build- and release-time (debug, verify-work, validate-phase, forensics) |
| `dev+meta` (dual-tag) | 2 | Cross-cuts product build and framework build (reverse-engineer, auto-conventions) |
| **Total tags** | 91 | (skills count once per skill; `dev+prod`/`dev+meta` listed once but tag both lanes) |

## DEV lane (60)

Default lane for product-building work. Includes the entire planning loop (`gad:*` planning verbs), execution, write-doc skills, and asset sourcing.

| Skill | One-line rationale |
|---|---|
| find-sprites | Asset sourcing for the product being built |
| gad-add-backlog | Capture ideas during build |
| gad-add-phase | Plan next chunk of build |
| gad-add-tests | Write tests for the product |
| gad-add-todo | Capture build-time idea |
| gad-audit-milestone | Audit build milestone |
| gad-audit-uat | Cross-phase build audit |
| gad-autonomous | Run build phases autonomously |
| gad-check-todos | Re-entry into build loop |
| gad-cleanup | Archive completed build phases |
| gad-complete-milestone | Close a build milestone |
| gad-discuss-phase | Phase ideation |
| gad-do | Route freeform text to build commands |
| gad-docs-compile | Compile product planning docs |
| gad-docs-update | Generate product docs |
| gad-execute-phase | Execute a build phase |
| gad-health | Diagnose planning-doc health for the product |
| gad-help | Help surface for the build loop |
| gad-insert-phase | Insert urgent build phase |
| gad-list-phase-assumptions | Surface assumptions before build |
| gad-manager | Multi-phase command center |
| gad-manuscript | Fiction writing (build-the-book equivalent of build-the-product) |
| gad-map-codebase | Explore the product codebase |
| gad-migrate-schema | Migrate product planning XML |
| gad-milestone | Milestone shaping |
| gad-milestone-summary | Summary of completed milestone |
| gad-new-milestone | Start new milestone for the product |
| gad-new-project | Initialize a new product |
| gad-next | Advance build loop |
| gad-note | Capture build idea |
| gad-pause-work | Hand off mid-build |
| gad-plan-milestone-gaps | Plan gaps in milestone |
| gad-plan-phase | Plan a build phase |
| gad-plant-seed | Forward-looking idea capture |
| gad-progress | Build progress check |
| gad-remove-phase | Remove future phase |
| gad-research-phase | Research how to build |
| gad-resume-work | Resume build session |
| gad-review | Cross-AI peer review of build plan |
| gad-review-backlog | Review backlog for next build cycle |
| gad-session | Session bridging |
| gad-session-report | Session report |
| gad-set-profile | Switch model profile for build agents |
| gad-settings | Configure build workflow |
| gad-stats | Project stats |
| gad-task-checkpoint | Mid-task checkpoint |
| gad-thread | Persistent context threads |
| gad-validate-phase | Audit phase for validation gaps (also dev+prod — see below) |
| gad-verify-phase | Build-time QA (also dev+prod — see below) |
| gad-write-feature-doc | Write product feature doc |
| gad-write-intent | Capture build intent |
| gad-write-tech-doc | Tech breakdown doc |
| gad-workspace-add | Register new planning root in build workspace |
| gad-workspace-show | Show planning roots |
| gad-workspace-sync | Crawl monorepo for planning roots |
| gad-eval-list | List eval projects (consumer-facing — picking what to build) |
| gad-eval-report | Compare evals (build-quality reporting) |
| gad-eval-run | Run a generation (build the species candidate) |
| gad-eval-spawn | Spawn a generation |
| phase-42.4-context-frameworks | Context-framework catalog work (phase-scoped, build-side) |
| scaffold-visual-context-surface | Scaffold a VCS surface (build-side UI primitive) |
| gad-visual-context-system | Build-side VCS contract |
| gad-visual-context-panel-identities | Build-side VCS identity contract |

## PROD lane (3)

Distinguishing test: skill output reaches **end users**, not framework agents.

| Skill | Rationale |
|---|---|
| build-and-release-locally | Cuts a release tarball + GitHub Release — distribution to end users |
| portfolio-sync | Keeps the public landing site at `vendor/get-anything-done/site/` reflecting the framework state — marketing/launch surface |
| gad-evolution-images | Generates project cover/marketing imagery via OpenAI — visual asset for a public surface |

## META lane (22) *(proposed new lane)*

Framework operating on itself. The "tools/devex" cluster.

| Skill | Rationale |
|---|---|
| create-skill | Author a new skill — framework-on-framework |
| create-proto-skill | Bulk drafter for proto-skills (evolution loop) |
| merge-skill | Combine near-duplicate skills |
| find-skills | Discover installed skills (the catalog itself) |
| eval-skill-install | Install + evaluate a skill in eval template |
| gad-skill-creator | Heavy-path skill authoring with real test runs |
| gad-proto-skill-battery | Run battery of proto-skills against eval set |
| gad-evolution-evolve | Drive the evolution loop (candidates → proto → canonical) |
| gad-evolution-validator | Validate evolution outputs |
| gad-discovery-test | Discover-step probe within evolution |
| gad-snapshot-optimize | Optimise snapshot output (the framework's own output) |
| framework-upgrade | Version the GAD framework itself |
| gad-update | Update GAD CLI to latest version |
| gad-reapply-patches | Reapply local mods after a framework update |
| gad-cross-config-domain-change | Coordinate cross-runtime config changes (claude/cursor/codex) |
| objective-eval-design | Design objective eval criteria |
| self-eval | Self-evaluation harness |
| trace-analysis | Analyse trace event streams |
| gad-bootstrap (`gad-eval-bootstrap`) | Bootstrap an eval-runner agent with full GAD context |
| gad-eval-suite | Run all evals in parallel (framework-wide eval pipeline) |
| gad-debug | Systematic debugging across context resets — framework-on-framework when debugging the framework itself; also dev+prod (see below) |
| gad-forensics | Post-mortem investigation for failed GAD workflows (failure analysis at framework level; also dev+prod) |

## DUAL-TAG candidates (cross-lane)

These skills genuinely apply at multiple lifecycle stages. Tag with both lanes in frontmatter (`lane: [dev, prod]`) rather than splitting into separate skills.

| Skill | Lanes | Rationale |
|---|---|---|
| gad-debug | dev, meta | Debugging during build (dev); also debugging the framework itself (meta) |
| gad-verify-work | dev, prod | Build-time QA (dev); also release-time UAT (prod) |
| gad-validate-phase | dev, prod | Build phase validation (dev); also retro-audit before release (prod) |
| gad-forensics | dev, meta | Post-mortem on a failed phase (dev); also failed framework runs (meta) |
| gad-reverse-engineer | dev, meta | Reverse-engineer any codebase into requirements — a build-side analysis tool, AND a framework methodology for absorbing external systems |
| gad-auto-conventions | dev, meta | Scaffold CONVENTIONS.md from codebase patterns — applies to product builds AND to framework convention extraction |

## Skills that fit NEITHER lane

None. All 91 skills slot cleanly into dev / prod / meta or a dual-tag combo. No deprecation candidates surfaced in this audit on lane-fit grounds. (Deprecation should be evaluated separately on usage-frequency + eval-evidence — out of scope for this catalog.)

## Open questions from the todo — answered

| Question | Answer | Reasoning |
|---|---|---|
| `gad-debug` — DEV or both? | **dev + meta** | Used during product build; also used to debug the framework. Not user-facing → not prod. |
| `gad-verify-phase` — DEV or PROD or both? | **dev** only | This is build-time phase verification, not release QA. The release-time analog is `gad-verify-work` (UAT). |
| `gad-verify-work` — DEV or PROD or both? | **dev + prod** | Conversational UAT against built features — applies both at end-of-phase (dev) and as pre-release UAT (prod). |
| `create-skill` — DEV or META? | **meta** | Authoring a methodology document is a framework activity, not a product-build activity. A user building their app rarely creates skills mid-build; skill authors do. |
| Does META need to be a third lane? | **Yes — recommended** | Without META, the `dev` catalog is polluted with 22 framework-on-framework skills that aren't relevant to a user just trying to ship their product. `gad skill list --lane dev` should stay focused. |

## Frontmatter rollout (phase 55 input)

Recommended schema:

```yaml
---
name: <skill-id>
description: >-
  ...existing description...
lane: dev          # or prod, or meta
# OR
lane: [dev, prod]  # dual-tag
---
```

Validation gates phase 55 should add:
- Every SKILL.md has a `lane:` field.
- Each lane value is one of `dev | prod | meta` (or a 1-2 element array of those).
- Catalog generator emits `lane` into `catalog.generated.ts`.
- `gad skill list --lane <lane>` filters the listing.
- Site `/skills` page surfaces the lane as a filter chip (rebrand-aware: phase 45 lane copy).

## Migration order (suggested for phase 55 execution)

1. **Wave 1 — META (22 skills)**: tag the framework cluster first. Lowest risk, smallest count, agent contributors are the consumers of the META filter.
2. **Wave 2 — PROD (3 skills)**: tag the three release/marketing skills.
3. **Wave 3 — DUAL (6 skills)**: tag the cross-lane skills with array values; ensures the schema validator handles both shapes.
4. **Wave 4 — DEV (60 skills)**: tag the long tail. Mostly mechanical — every `gad-*` skill not already tagged is `dev`.
5. **Wave 5 — Catalog + CLI + site filters**: emit lane to `catalog.generated.ts`, add `--lane` filter to `gad skill list`, add lane chips to site `/skills`.

Estimated scope: ~91 SKILL.md edits + 1 catalog generator change + 1 CLI flag + 1 site filter component. Atomic per-wave commits keep diffs reviewable.
