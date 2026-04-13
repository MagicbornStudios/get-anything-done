---
status: candidate
source_phase: "21"
source_phase_title: "Eval framework evolution: v3 scoring, gates, preservation contract, greenfield/brownfield"
pressure_score: 56
tasks_total: 28
tasks_done: 26
crosscuts: 14
created_on: "2026-04-13"
created_by: compute-self-eval
---

# Candidate from phase 21

## Phase

```
get-anything-done | 21 | Eval framework evolution: v3 scoring, gates, preservation contract, greenfield/brownfield
selection pressure: 56  (28 tasks, 26 done, 14 crosscuts)
```

## Tasks

```
21-01 done Fix MCP UTF-8 buffer bug: Content-Length counts bytes but handleData used string.length. tools/list responses with em dashes broke the parser. Switch to Buffer throughout MCP harness and server.
21-02 done Speed up planning-ref-verify by reading from planning-config roots instead of full tree walk, plus cache fs.statSync results.
21-03 done Standardize implementation eval composite formula. Replace inconsistent per-eval weights with a single v3 formula: requirement_coverage + planning_quality + per_task_discipline + skill_accuracy + time_efficiency + human_review. Document in DEFINITIONS.md.
21-04 done Clean skill_accuracy: remove methodology behaviors (decisions-captured, multi-phase-planning, phase-completion, task-lifecycle) from expected_triggers. Only actual /gad:* skill invocations count.
21-05 done Add gad eval review CLI command to record human review scores that get folded into the composite with the v3 weights.
21-06 done Add gad eval open CLI command to serve eval build output via local HTTP server (file:// doesn't work for ES module bundles from Vite/KAPLAY).
21-07 done Create escape-the-dungeon-bare eval project: same game requirements, no GAD framework, agent creates own workflow. Baseline A/B comparison for the freedom hypothesis.
21-08 done Create escape-the-dungeon-emergent eval project: no framework, but inherits skills from the previous run. Tests whether self-created systems improve iteratively.
21-09 done Version game requirements. Document v1→v2→v3 history inside REQUIREMENTS.xml. Each eval round should reference the requirements version it used.
21-10 done Build requirements v3: add gate criteria (game loop, spell crafting, UI quality) that override requirement_coverage to 0 if failed. Trim source gameplay design doc from 640 → 120 lines for the vertical slice focus.
21-11 done Run round 2 greenfield evals with v2 requirements. Three conditions: GAD v7, Bare v2, Emergent v1.
21-12 done Run round 3 greenfield evals with v3 requirements (gates). GAD v8, Bare v3, Emergent v2.
21-13 done Document the freedom hypothesis finding: GAD framework constraint correlates inversely with creative output quality on greenfield game implementation. Capture in FINDINGS doc and decision.
21-14 done Build eval preservation contract: gad eval preserve command that copies code+planning+build+logs to canonical per-version locations. Enforce via tests/eval-preservation.test.cjs.
21-15 done Fix eval preserve to copy the ENTIRE project (not cherry-picked files). Agent may create files we don't anticipate.
21-16 done Mandate game/.planning/ as the home for all eval workflow artifacts regardless of framework. Bare and emergent must put workflow files there too, not at project root.
21-17 done Add gad worktree management commands: list, show, clean, prune. User had no visibility into .claude/worktrees/agent-* directories.
21-18 done Categorize evals by eval_mode (greenfield|brownfield) and workflow (gad|bare|emergent). Show in gad eval list.
21-19 done Create three brownfield eval projects (etd-brownfield-gad/bare/emergent) using bare v3 as baseline. Shared extension requirements (_brownfield-extensions-v4.md) describing v4 features (floor progression, respawning encounters, forge affinity, skills system, visual upgrade).
21-20 done Port session tracking into TASK-REGISTRY.xml instead of Claude Code Task tool. Stop using ephemeral session tasks for GAD-tracked work.
21-21 done Create an experiment log doc (evals/EXPERIMENT-LOG.md) that tracks every round: conditions, requirements version, results, findings. Running ledger across all rounds.
21-22 done Build requirements v4: pressure-oriented design (not features checklist). Authored dungeon with floors → 5-8 rooms → boss gate. Room types: Combat, Elite, Forge, Rest, Event. Each floor must introduce a mechanical constraint that can't be brute-forced with default spells. Forge is gate with at least one encounter per floor that favors crafted/adapted spells. Pressure mechanics required from at least 2 of 4 categories. Starter abilities explicitly insufficient. Skills scored but not gate (combat needs non-spell action category only). Sprites: attempt sourcing first, coherent fallback allowed. Traits label in UI, narrativeStats in code. Add ingenuity/adaptation scoring dimension.
21-25 done Create create_skill skill doc (skills/create-skill/SKILL.md) that documents how bare/emergent agents can define their own reusable skills. Only skill bare starts with; emergent starts with create_skill + inherited skills from previous runs.
21-26 done Rewrite bare and emergent AGENTS.md to be truly minimal. Stop mandating ARCHITECTURE.md, CHANGELOG.md, or any specific artifact. Only mandate: (1) all workflow artifacts in game/.planning/, (2) reference create_skill skill for defining new skills. Everything else is agent-defined. This defeats the previous round's too-prescriptive guidance and lets us observe what emergent workflows actually produce.
21-27 done Create gad:find-sprites skill (skills/find-sprites/SKILL.md) that documents the asset sourcing workflow: web search for free/open-license sprites and icons, preference order (npm packs → web search → generated → geometric fallback), integration tips, license verification. Referenced by v4 AGENTS.md for all 3 greenfield conditions.
21-23 done Run round 4 greenfield with v4 requirements. Three conditions: GAD, Bare, Emergent. All with pressure-oriented gates.
21-23b planned Retry GAD greenfield v11 after HTTP 529 investigation. First attempt at v10 (tool_uses=55) completed phases 01+02 (scaffold + data layer) before Anthropic API returned overloaded_error. Previous attempt crashed earlier at tool_uses=18. Pattern suggests GAD's setup-heavy phases (snapshot + planning XML writes) spend proportionally more time in server-dependent states during peak load periods. Investigation needed: (1) check Anthropic status page for correlation with our crash timestamps; (2) test whether spreading the snapshot + plan calls across shorter API invocations reduces 529 exposure; (3) consider a retry-with-backoff wrapper in the eval runner for 529 specifically (not for rate limits). Only retry GAD v11 after investigation produces a mitigation or explicit "try again, the API was just overloaded that hour" conclusion.
21-24 cancelled Run round 1 brownfield experiments. Three conditions using bare v3 baseline + v4 extensions. BLOCKED on portfolio documentation (21-28).
```

## What this candidate is for

This file was auto-generated by `compute-self-eval.mjs` because phase
21 exceeded the selection pressure threshold. High pressure
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
- `ls vendor/get-anything-done/sdk/skills/` — existing skills to avoid
  duplicating

The drafter does **not** ask a human for anything. Make decisions and
document them in the SKILL.md.

## Output location

The drafter writes to `skills/proto-skills/phase-21-eval-framework-evolution-v3-scoring-gate/SKILL.md` — a
**different directory** from this candidate. Candidates and proto-skills
are two distinct stages:

- **candidate** (this file) = raw selection-pressure output
- **proto-skill** (drafter output) = drafted SKILL.md awaiting human review
- **skill** (post-promote) = lives in `sdk/skills/` as part of species DNA

The human reviewer runs `gad evolution promote <slug>` or
`gad evolution discard <slug>` after reviewing the proto-skill.
