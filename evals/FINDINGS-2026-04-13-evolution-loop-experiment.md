---
projects: [escape-the-dungeon, escape-the-dungeon-bare, escape-the-dungeon-emergent]
date: 2026-04-13
round: framework
gad_version: null
---

# Curator vs Raw — designing the evolution loop's drafting step

Two controlled experiments to answer one question: **when GAD evolves itself by drafting new skills from high-pressure phases, should a curator pre-digest the phase data into a structured intent, or should we feed the raw phase dump straight to a skill creator?**

The answer flipped between experiments. Both flips are recorded here so the architecture decision lands on evidence, not vibes.

## TL;DR — the surprising flip

| Experiment | Tool under test | Curator helps? | Why |
|---|---|---|---|
| **v1** — Anthropic skill-creator with full eval loop | heavy (drafts + runs subagent test loop + benchmarks + viewer) | **YES** — curator catches load-bearing pieces (trace schema fragment, preserve reminder) raw arm misses entirely | Heavy harness fights the agent; curated INTENT.md unblocks it |
| **v2** — dot-agent create-skill (light authoring guide) | light (formats and structures only, no eval loop) | **NO** — raw arm pulls 16 decisions vs curator's 7. Curator is a **filter**, not an amplifier | Light harness lets the agent read the data; curator adds opinions that may filter out important content |
| **v2 test-loop** — agents using the resulting skill | n/a | **NO**, plus skill is **wrong** about repo conventions | Baseline (no skill, reads repo) wrote a more accurate gad.json shape than with-skill (which followed the skill's prescription) |

**The combined finding:** When generating skills, give the agent raw access. When the curator filters, they may filter out the truth. When the skill prescribes conventions, validate them against the actual repo or the agent will follow false rules confidently.

## Experiment design

| | v1 | v2 — quick-skill | v2 — test loop |
|---|---|---|---|
| Subjects | 2 (raw, intent) | 2 (raw, intent) | 2 (with-skill, baseline) × 3 prompts |
| Source data | Phase 14 of GAD | Phase 14 of GAD | Stub design docs + the skill from v2 intent arm |
| Tool | `~/.agents/skills/skill-creator` (Anthropic, 485 lines) | `~/.agents/skills/create-skill` (dot-agent, 78 lines) | Subagents loaded with skill / no skill |
| Eval loop | Subagent test runs + grading + viewer (simulated due to nested subagent limits) | Skipped — quick-skill has no test loop | Real subagent runs from main thread |
| Sandbox | `oneoff/raw/`, `oneoff/intent/` | `oneoff/v2/raw/`, `oneoff/v2/intent/` | `oneoff/v2/test-runs/` |

## Inputs side by side

Both arms across both experiments saw the same source: phase 14 of GAD's own development ("Eval framework — escape-the-dungeon + tracing"). The difference is the framing.

### Raw input

A flat dump of `gad tasks --projectid get-anything-done | grep " 14-"` plus `gad decisions ... | grep -i trace`. No structure, no proposed name, no test prompts, no historical context. The agent reads it cold.

```
14-01  done  Create a gad eval project "escape-the-dungeon" from GAMEPLAY-DESIGN.xml...
14-02  done  Create bin/gad-tools.cjs — the GAD equivalent of gsd-tools.cjs...
14-03  done  Define the eval trace format for real implementations: track which gad...
14-04  done  Define the eval scoring rubric for real implementations: CLI efficiency...
14-05  done  Run the escape-the-dungeon eval: fresh agent session...
14-06  done  Run the portfolio-bare eval with updated tracing...
14-07  done  Review CONTEXT.md: what it is, how discuss-phase produces it...
```

### Curated INTENT input

The same data, plus my curator labor: a proposed name (`scaffold-traced-eval-project`), a "What this skill should do" paragraph, "When it should trigger" bullet list, "Expected output format" table, three test prompts I drew from real phase tasks, a hand-picked subset of decisions, and an "Errors observed" section with the historical "three attempts at task 14-03 failed" insight.

The full file is at `oneoff/v2/intent/INTENT.md` — 113 lines of structured curator pre-digestion.

## v2 quick-skill — outputs side by side

Both arms produced a SKILL.md with the same target name (`scaffold-traced-eval-project`). Only the input format varied.

| Metric | RAW arm | INTENT arm |
|---|---|---|
| **SKILL.md lines** | 167 | 158 |
| **References files split** | 4 | 3 |
| **Decisions cited** | **16** | **7** |
| **Tasks cited** | 5 (14-01 → 14-05) | 2 (14-03, 14-04) |
| **Workflow steps** | 8 | 10 |

### What each arm caught vs missed

| Load-bearing detail | RAW caught | INTENT caught |
|---|---|---|
| TRACE.json schema v4 parent/child IDs (gad-50) | ✓ | ✗ |
| `gad-trace-hook.cjs` wiring (gad-59) | ✓ | ✗ |
| `.trace-active-skill` marker (gad-58) | ✓ | ✗ |
| 4 KB output cap (gad-60) | ✓ | ✗ |
| Runtime identity in trace (gad-137) | ✓ | ✗ |
| Per-eval-repo architecture (gad-139) | ✓ | ✗ |
| `gad-tools.cjs` vendoring floor (task 14-02) | ✓ | ✗ |
| Rate-limited preservation (gad-63) | ✓ | ✗ |
| Mandatory `gad eval preserve` reminder (gad-38) | ✗ | ✓ |
| Fragment-registration pattern explicit | partial | ✓ |
| Historical "3 failed attempts" context | ✗ | ✓ |
| Explicit "common errors" section | ✗ | ✓ |

**RAW pulls in MORE technical breadth.** It catches 8 decisions INTENT skipped because INTENT only listed the decisions I, the curator, chose to surface. **The curator is a filter.**

INTENT still wins on the irreplaceable bits: the historical context that lives in commit history, not decision text. But that's a smaller win than I expected.

## v2 test loop — does the resulting skill actually help an agent?

After v2 quick-skill produced a SKILL.md, we ran a **real test loop** with subagents spawned from the main thread (so Task tool was actually available). Three test prompts × with-skill / baseline pairs = 6 leaf subagents.

| Eval | Prompt | with-skill | baseline |
|---|---|---|---|
| **1** | Scaffold an eval project from `space-shooter-design.md` | 4/4 ✓ | 3/4 |
| **2** | Scaffold an eval project from `data-pipeline-requirements.md` | 4/4 ✓ | 3/4 |
| **3** | (negative) "run the existing escape-the-dungeon eval against bare condition" | 4/4 ✓ | 4/4 ✓ |
| **Total** | | **12/12 (100%)** | **10/12 (83%)** |

**Headline number favors with-skill by +16.7pp. The story behind it does not.**

The entire 2-assertion gap comes from one thing: the `scaffold-traced-eval-project` skill prescribes 3 GAD-native scoring dimensions (CLI efficiency, skill trigger accuracy, planning quality). The with-skill agent followed that prescription verbatim. The baseline agent **read `vendor/get-anything-done/evals/escape-the-dungeon/gad.json` directly** and produced a richer scoring shape that **matches what the repo actually uses today**:

| Field in baseline gad.json | Present in actual repo? | Present in skill's prescription? |
|---|---|---|
| `eval_mode` | ✓ | ✗ (uses `mode`) |
| `scoring.weights` (6 dims) | ✓ | ✗ (uses 3 dims) |
| `human_review_rubric.dimensions` | ✓ | ✗ |
| `compare_to` | ✓ | ✗ |
| `domain` / `tech_stack` / `build_requirement` | ✓ | ✗ |

**The skill is prescriptively wrong about what GAD evals actually look like.** Baseline did the more *accurate* job by reading the actual repo, but failed an assertion that grades against the skill's view. Baseline produced more files (REQUIREMENTS.md + .planning/ skeleton + AGENTS.md + v1 placeholders) modeled directly on `escape-the-dungeon`'s structure.

The negative test was a wash. Both arms recognized eval-3 as an execution task and refused to scaffold. With-skill cited the skill's "Do NOT trigger for: running an existing eval" clause; baseline reasoned from first principles. The defensive description helped, but baseline's general reasoning didn't need it.

## What we changed in the architecture

**Before this experiment**, my proposal was: `evolve` curates an INTENT.md per high-pressure phase, hands it to a heavy skill-creator, runs an eval loop, then human review.

**After**, the loop is much shorter and the curator is gone:

```
gad:evolution:evolve
  ├─ compute-self-eval finds high-pressure phases (selection pressure)
  ├─ for each phase:
  │     ├─ write skills/proto-skills/<slug>/CANDIDATE.md
  │     │     = raw phase dump (no curator pre-digestion)
  │     ├─ invoke gad-quick-skill on CANDIDATE.md
  │     │     → writes SKILL.md + references/
  │     └─ validator runs (advisory, non-blocking)
  │           → writes VALIDATION.md flagging file refs / CLI / shape mismatches
  └─ register one TASK-REGISTRY review task

(human review)
  reads SKILL.md + VALIDATION.md → promote or discard

gad evolution promote <slug> → moves to skills/ (joins species DNA)
gad evolution discard <slug> → deletes
```

Three dropped components:

| Dropped | Why |
|---|---|
| Curator step (hand-written INTENT.md) | RAW arm pulled MORE decisions than curated; curator is a filter |
| Heavy `skill-creator` with eval loop | dot-agent quick-skill produces good skills from raw input alone |
| `attempt-evolution` / `finish-evolution` skills | Promote/discard are one-line file moves, not skills |

One added component:

| Added | Why |
|---|---|
| Validator (advisory) | The skill may prescribe conventions that don't match the repo. Validator flags the gap so the human reviewer sees it before promoting. |

## Methodology caveats

- **v1 nested subagent fidelity:** The v1 experiment subagents tried to spawn their own with-skill / baseline subagents for the eval loop, but spawned subagents don't get the Task tool. Both v1 arms reported simulating the test runs inline. The pass-rate numbers from v1 are NOT real — only the SKILL.md outputs are.
- **v2 quick-skill subagents** had the same nested limit but didn't need Task because dot-agent has no eval loop. Their outputs are real.
- **v2 test loop** ran from the main thread, where Task is available. The 6 test subagents are real, independent runs.
- **Stub input files** (`oneoff/v2/test-runs/inputs/*.md`) were written by hand for the test prompts — `space-shooter-design.md` and `data-pipeline-requirements.md` are realistic but invented. This mirrors what skill-creator's normal harness would do (sandbox stubs).

## Files

All inputs, intermediate artifacts, and outputs preserved under:

| Path | Contents |
|---|---|
| `oneoff/raw/` | v1 raw arm (skill-creator + raw phase 14) |
| `oneoff/intent/` | v1 intent arm (skill-creator + curated INTENT.md) |
| `oneoff/v2/raw/` | v2 raw arm (dot-agent quick-skill + raw phase 14) |
| `oneoff/v2/intent/` | v2 intent arm (dot-agent quick-skill + curated INTENT.md) |
| `oneoff/v2/test-runs/inputs/` | stub design docs (space-shooter, data-pipeline) |
| `oneoff/v2/test-runs/outputs/with-skill/` | 3 leaf subagent runs using the skill |
| `oneoff/v2/test-runs/outputs/without-skill/` | 3 leaf subagent runs without the skill |

The v1 viewer.html files (`oneoff/raw/skill/viewer.html`, `oneoff/intent/skill/viewer.html`) render the simulated test runs with skill-creator's HTML viewer — useful for skim comparison even though the underlying numbers are simulated.

