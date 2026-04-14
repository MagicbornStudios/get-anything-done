---
status: candidate
source_phase: "42.4"
source_phase_title: "Context framework as first-class catalog type — installable as a project dependency parallel to skills/agents/workflows/tech-stacks"
pressure_score: 49
tasks_total: 19
tasks_done: 19
crosscuts: 15
created_on: "2026-04-14"
created_by: compute-self-eval
---

# Candidate from phase 42.4

## Phase

```
get-anything-done | 42.4 | Context framework as first-class catalog type — installable as a project dependency parallel to skills/agents/workflows/tech-stacks
selection pressure: 49  (19 tasks, 19 done, 15 crosscuts)
```

## Tasks

```
42.4-01 done Scaffold ContextFramework as a new top-level catalog type parallel to skills/agents/workflows/tech-stacks (decision gad-179).
42.4-02 done /context-frameworks index page + /context-frameworks/[slug] detail pages.
42.4-03 done Project metadata gains a `contextFramework` field resolved from gad.json.
42.4-04 done Patch `gad snapshot` lane bootstrap so plain project snapshots do not auto-register idle agent lanes, and prune stale unclaimed default lanes that were leaked by the old behavior. Capture the skill-catalog consolidation rule for duplicate public skill names.
42.4-05 done Normalize the command-skill catalog so procedural legacy duplicates are consolidated into `gad-*` workflows/references, keep only canonical `gad-*` command skills in `skills/`, and make the naming contract explicit.
42.4-06 done Finish the remaining canonical-skill cleanup outside the first six command pairs and add an automated validator so duplicate public names and broken canonical references fail fast.
42.4-07 done Move staged proto-skills into the owning project's `.planning/` tree, add a direct proto-skill install command for coding-agent runtimes, and align evolution docs/state so staged proto-skills are treated as planning artifacts until explicit install or promotion.
42.4-08 done `gad projects init` defaults to canonical XML and scaffolds the full file set. Currently it writes 4 markdown template files (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md) containing literal template placeholders. The rest of the monorepo uses 6+ canonical XML files (STATE.xml, ROADMAP.xml, TASK-REGISTRY.xml, DECISIONS.xml, ERRORS-AND-ATTEMPTS.xml, REQUIREMENTS.xml). Surfaced 2026-04-14 during app-forge scaffolding â€” the markdown output had to be hand-converted to XML, see ERRORS-AND-ATTEMPTS entry `forge-init-md-misaction-2026-04-14`. Fix: update `bin/gad.cjs projects init` (or wherever the scaffold lives) to write the canonical XML file set with valid empty headers. Optional `--format md` flag for the legacy markdown path. Also scaffold the missing files (TASK-REGISTRY, DECISIONS, ERRORS-AND-ATTEMPTS) regardless of format.
42.4-09 done Project shape format review and refresh. The "canonical XML file set" for a planning root has drifted over time (some projects have HUMAN-TODOS.xml, some have phases/, some have plans/, some have proto-skills/, some have notes/). There is no single documented shape that `gad projects init` and `gad health` agree on. Audit the actual file sets across all registered planning roots (global, get-anything-done, magicborn, app-forge, etc.), define the canonical minimum + canonical optional file set, document it in references/, and align both `projects init` and `gad health` against it. Surfaced 2026-04-14 by the user during app-forge scaffolding: "the project shape format needs to be reviewed/updated soon."
42.4-10 done Audit existing `gad sink` and `gad docs` command surface for the markdownâ†’XML conversion gap before adding new commands. CORRECTION 2026-04-14: original framing of this task assumed no conversion path existed and proposed `gad migrate-schema --from md --to xml`. User pointed out we already have `gad docs compile`, `gad sink compile/decompile/sync/diff/status/validate` â€” bidirectional sink flow exists. `gad sink decompile` specifically "ensures .planning/ dirs exist for all projects; creates stubs for missing source files" which is close to but not identical to the MDâ†’XML conversion needed. Audit: does any existing command convert markdown PROJECT/REQUIREMENTS/ROADMAP/STATE prose into canonical XML? If yes, document it and close this task. If no, decide whether to extend `gad sink decompile` to handle the case or add a focused subcommand. Don't add new commands until we've ruled out the existing surface.
42.4-11 done Sink coherence investigation: map the full doc compilation pipeline so agents know which surface to edit when. Concern surfaced 2026-04-14 by user: "I am pretty sure we have a planning sink set up. We need to investigate why at some point and make sure all our docs compile to the same place." The repo has `[planning] docs_sink = "docs"` in gad-config.toml, `[[docs.projects]]` and `[[planning.roots]]` registries, `gad docs compile`, `gad sink compile/sync/decompile/diff/status/validate`, plus `gad site compile` (phase 10). It's unclear from the outside which command is canonical for: (a) editing a planning root's ROADMAP/DECISIONS/etc, (b) updating a docs.projects entry, (c) keeping the compiled MDX in `docs/&lt;id&gt;/planning/` in sync with `.planning/` source, (d) what happens when both source and sink drift. Output: a short references/sink-pipeline.md doc explaining the full flow + a quick-reference table mapping "I want to edit X" â†’ "use command Y" â†’ "verify with Z." Then update relevant skills (new-project, plan-phase, execute-phase) to reference it.
42.4-12 done Multi-root eval discovery. Add `[[evals.roots]]` array to `gad-config.toml` mirroring `[[planning.roots]]`. Default root stays `vendor/get-anything-done/evals/` for backwards-compat. New roots like parent-repo `evals/` (or `apps/forge/evals/`) become first-class. `gad eval list/run/preserve/verify/open/review/report` all walk the union of roots. Eval project ids must be unique across roots â€” duplicate detection at load time. Surfaced 2026-04-14 during app-forge planning: forge wants to consume evals from the parent custom_portfolio repo without polluting the framework submodule with downstream user projects, AND forge's own eval project (app-forge) needs to live outside the GAD submodule because forge is not a framework component. Blocks app-forge eval bootstrap (decision forge-09 plan/build separation requires fresh-agent spawn for any forge implementation work).
42.4-13 done New skill + slash command `/gad-eval-spawn` for kicking off eval runs from inside a Claude Code session. Wraps `gad eval run --project &lt;name&gt; --execute` to get the JSON spec, then uses the orchestrator's Agent/spawn capability to launch a worktree-isolated Claude (or other runtime) agent against the spec. Writes a session marker (probably under `.planning/.eval-runs/&lt;run-id&gt;.json`) so the orchestrator knows which run is in flight, can poll status, and can preserve outputs via `gad eval preserve` after completion. Authored via the `create-skill` skill so we dogfood the skill-authoring pattern. Skill name: `gad-eval-spawn`. Slash command: `/gad-eval-spawn &lt;project&gt; [--runtime claude-code] [--baseline HEAD]`. Surfaced 2026-04-14 by user: "we need a skill use create skill and also our command workflow pattern for /gad-project-eval-run or whatever we should call it to actually kick start the flow in claude code." Per decision forge-09 (plan/build separation), this skill is the seam between the orchestrating session and the spawned builder session.
42.4-14 done Audit and finish phase 43 species.json migration. Phase 43 unified the eval schema around `evals/&lt;project&gt;/project.json` + `evals/&lt;project&gt;/species/&lt;species&gt;/species.json`, but escape-the-dungeon's existing species directories still use `gad.json` instead of `species.json`. Decide canonical name (recommend: `species.json` per phase 43 spec) and either: (a) rename `gad.json` â†’ `species.json` across all existing species in `vendor/get-anything-done/evals/`, OR (b) update phase 43 prose + the CLI loader to treat `gad.json` as the canonical name and abandon `species.json`. User direction 2026-04-14: do the rename to species.json. Update CLI loaders, build-site-data.mjs, eval-preservation tests, and any references in skills/workflows/docs. Pick one shape so app-forge's species file isn't ahead of reality and so the project âŠ‡ species inheritance contract (42.4-15) has a stable file shape to read from.
42.4-15 done Project âŠ‡ Species inheritance contract in the CLI eval loader. `project.json` declares defaults: `techStack`, `contextFramework`, `installedSkills`, `defaultContent` (paths or refs to default assets/files/scaffolding). `species.json` may override any of those + adds species-only fields: `inherits_from` (parent species for cross-species lineage), `dna` (workflow + skill manifest summary), species-specific `description`. The CLI's eval loaders (used by `gad eval list/run/preserve` and by build-site-data.mjs) MUST merge project + species at load time and return the merged shape â€” readers should never manually combine them. Shipped: new `lib/eval-loader.cjs` exporting `loadProject`, `loadSpecies`, `loadAllSpeciesRaw`, `loadResolvedSpecies`, `loadAllResolvedSpecies`, `mergeProjectSpecies`, `resolveInheritanceChain`. Merge semantics per decision gad-184: project defaults â†’ inherits_from chain (deepest ancestor first) â†’ target species; last write wins; arrays REPLACE not merge; species-only fields (inherits_from, dna, description) do not back-propagate to project; cycles throw. Wired `bin/gad.cjs eval list` to the loader and swapped `site/scripts/build-site-data.mjs scanEvalProjects` to use `loadResolvedSpecies` so the site sees the merged shape. Hermetic tests in `tests/eval-loader-inheritance.test.cjs` cover (a)-(e) plus loadAllResolvedSpecies + pure-function spot check (7/7 pass via `node --test`). Other legacy `gad.json` reads in bin/gad.cjs (eval run, eval verify, eval review, eval open/report) are orthogonal rename fallout and left for a separate surgical pass.
42.4-16 done Forge proving-ground spec: formalize "forge produces a passing escape-the-dungeon generation from its existing REQUIREMENTS.md via the editor's spawn flow" as a measurable acceptance criterion. Decision forge-11 captures the why. Output: checklist doc at `apps/forge/.planning/plans/forge-proving-ground.md` defining PG-01..PG-09 (build preserved, clean headless load, zero console.error, game root mounts, player renders, tilemap renders, input moves player, no unhandled rejections, probe runtime &lt; 30s). Historical comparison table retroactively scores all 12 ETD gad-species generations (v1..v12): 4 have preserved builds (v7, v8, v9, v10), exactly 1 (v8) has an explicit SCORE.md "Build requirement gate PASSED" annotation, and PG-02..PG-08 are `?` across the board because no mechanical probe has ever run against an ETD build. GAPs flagged: no Playwright harness in repo (phase 08 scope), no canonical ETD root selector / player hook, input scheme varies arrow vs WASD. DOG-02 in `apps/forge/.planning/REQUIREMENTS.xml` and phase 08 success criteria in `apps/forge/.planning/ROADMAP.xml` both updated to cite the checklist. Last of the 42.4-12..16 framework gates blocking app-forge phase 01.
42.4-17 done Implement `gad planning hydrate` â€” the MD â†’ XML inverse of `gad docs compile`. Closes the follow-up flagged by task 42.4-10's audit (references/sink-md-xml-audit.md Â§6). Subcommand walks configured planning roots (or `--projectid`/`--all`), reads sibling markdown for each canonical slot (STATE, ROADMAP, DECISIONS, TASK-REGISTRY, REQUIREMENTS), and writes canonical XML into the root's `.planning/` directory. Supports `--from &lt;dir&gt;` to read MD from an external source dir (default is the planning dir itself), `--dry-run` to print the generated XML without writing, and `--force` to overwrite existing XML (prior XML is archived under `.planning/archive/xml/&lt;ts&gt;/` first). Non-force runs skip slots where the XML already exists, preserving the "XML is authoritative" invariant from decision 42.4-10.
42.4-18 done Delete dead project-level `gad.json` fallthrough reads in `bin/gad.cjs` (decision gad-184). Task 42.4-14 renamed `evals/&lt;project&gt;/gad.json` to species-level `evals/&lt;project&gt;/species/&lt;sp&gt;/species.json`, but five call sites in `bin/gad.cjs` (buildEvalPrompt / eval run metadata + traceScaffold / eval verify / eval review --rubric / eval readme) still read from the old project-level path. Because the file no longer exists, every read silently fell back to `{}` and every downstream field rendered as a default or dash â€” legacy fallback fallout flagged in task 42.4-15's note. Delete the reads; inline defaults where a field must remain; rewire `eval review --rubric` and `eval readme` through `lib/eval-loader.cjs::loadAllResolvedSpecies` so they pull `humanReviewRubric` / description / domain / tech stack / build requirement from the resolved-species shape instead.
42.4-19 done Normalize species.json keys to camelCase (decision gad-184, follow-up to task 42.4-15). The project âŠ‡ species inheritance loader (`lib/eval-loader.cjs`) does literal key matching via `applyLayer`, so when `project.json` declares `techStack` (camelCase) and a species declares `tech_stack` (snake_case), the species override silently fails and both keys end up on the merged shape. Per gad-184 contract, camelCase is canonical. Rename `tech_stack`, `build_requirement`, `human_review_rubric`, and `context_framework` to camelCase across every species.json under `evals/escape-the-dungeon/species/*/` and `evals/gad-explainer-video/species/*/`; confirm the eval loader needs no special-casing (it does not â€” literal-match is the point); update all consumers reading those snake_case keys.
```

## What this candidate is for

This file was auto-generated by `compute-self-eval.mjs` because phase
42.4 exceeded the selection pressure threshold. High pressure
signals a recurring pattern that may want to become a reusable skill.

This is the **raw input** to the drafting step. The drafter (`gad-quick-skill`,
invoked by `gad-evolution-evolve`) reads this file and decides what the
skill should be. No curator pre-digestion happens — see the 2026-04-13
evolution-loop experiment finding for why
(`evals/FINDINGS-2026-04-13-evolution-loop-experiment.md`).

## How the drafter should enrich this

The drafter should pull additional context from:

- `gad decisions --projectid get-anything-done | grep -i <keyword>` —
  relevant decisions for this phase
- `git log --follow --oneline <file>` — historical context for files this
  phase touched (catches the "three attempts at task X failed" thread that
  lives in commit history)
- `gad --help` and `gad <subcommand> --help` — CLI surface available
  to the skill
- `ls vendor/get-anything-done/skills/` — existing skills to avoid
  duplicating

The drafter does **not** ask a human for anything. Make decisions and
document them in the SKILL.md.

## Output location

The drafter writes to `.planning/proto-skills/phase-42.4-context-framework-as-first-class-catalog/SKILL.md` — a
**different directory** from this candidate. Candidates and proto-skills
are two distinct stages:

- **candidate** (this file) = raw selection-pressure output
- **proto-skill** (drafter output) = drafted SKILL.md awaiting human review
- **skill** (post-promote) = lives in `skills/` as part of species DNA

The human reviewer runs `gad evolution promote <slug>` or
`gad evolution discard <slug>` after reviewing the proto-skill.
