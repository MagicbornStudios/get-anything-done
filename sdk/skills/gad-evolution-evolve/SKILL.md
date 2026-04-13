---
name: gad-evolution-evolve
description: >-
  Start a new evolution of the GAD framework — analyze high-pressure phases via
  selection pressure, write a raw CANDIDATE.md per phase, hand each one to
  gad-quick-skill for autonomous drafting, then run the validator. Use when
  the user says "let's evolve", "run an evolution", "find new skills",
  "what skills should we add", or after closing a milestone where you want to
  capture lessons. An evolution is the primary mechanism by which GAD's species
  (its DNA / skill set) improves between milestones. Refuses to run if any
  pending proto-skills from a previous evolution still need human review —
  clear the queue first via gad evolution promote / discard.
---

# gad-evolution-evolve

Drives one round of the GAD evolution loop. Every evolution produces a batch of
**proto-skills** that must be reviewed by a human before they become real
skills.

## Mental model

> A species' identity = its DNA = its installed skill set.
> Evolving the species means evolving the skill set.
> An evolution is one batch of proposed skill changes.

The loop:

```
gad:evolution:evolve
  ├─ compute-self-eval finds high-pressure phases (selection pressure)
  ├─ for each new candidate phase:
  │     ├─ write skills/proto-skills/<slug>/CANDIDATE.md
  │     │     = raw phase dump (no curator pre-digestion)
  │     ├─ invoke gad-quick-skill on CANDIDATE.md
  │     │     → writes skills/proto-skills/<slug>/SKILL.md + references/
  │     └─ invoke gad-evolution-validator on the new proto-skill
  │           → writes skills/proto-skills/<slug>/VALIDATION.md (advisory)
  └─ register one TASK-REGISTRY task: "Review evolution <id> proto-skills"

(human review, async)
  reads SKILL.md + VALIDATION.md → promote or discard

gad evolution promote <slug>     ← moves to sdk/skills/, joins species DNA
gad evolution discard <slug>     ← deletes the proto-skill
```

The next `gad:evolution:evolve` cannot run until every proto-skill from the
current evolution is either promoted or discarded.

## Why no curator step

Earlier sketches of this loop had me hand-write a structured INTENT.md per
candidate — pre-digesting the phase data into proposed name, when-to-trigger
sections, hand-picked decisions, and curated test prompts.

The 2026-04-13 evolution-loop experiment showed that **curators are filters,
not amplifiers.** When given raw phase data directly, the drafting agent
pulled in 16 decisions vs the curated arm's 7. The curator's selectivity
filtered out load-bearing details (trace schema fragment registration, runtime
identity, per-eval-repo architecture). See
`evals/FINDINGS-2026-04-13-evolution-loop-experiment.md` for the full result.

So we feed raw phase dumps directly. CANDIDATE.md is a structured layout of
the phase tasks, decisions, file references, CLI surface, and `git log`
highlights for files the phase touched — not curated context.

## Step 1: Refuse to start if there's a pending evolution

```sh
PENDING=$(ls skills/proto-skills 2>/dev/null | wc -l)
if [ "$PENDING" -gt 0 ]; then
  echo "Cannot start a new evolution — $PENDING proto-skills still pending review."
  echo "Run 'gad status' to see them, then promote or discard each before evolving again."
  exit 1
fi
```

This is the human-review gate. It exists because evolutions accumulating
without review just rot.

## Step 2: Generate an evolution id

```sh
EVOLUTION_ID="$(date +%Y-%m-%d)-$(printf '%03d' $(( $(ls skills/.evolutions 2>/dev/null | wc -l) + 1 )))"
mkdir -p skills/.evolutions
touch "skills/.evolutions/$EVOLUTION_ID"
```

The empty marker file lets `gad status` and the site know an evolution started
on this date even after all its proto-skills are reviewed and gone.

## Step 3: Run selection pressure analysis

The existing self-eval pipeline identifies high-pressure phases:

```sh
node site/scripts/compute-self-eval.mjs
```

After it runs, read `site/data/self-eval.json` for the `high_pressure_phases`
list. Each phase id whose pressure score exceeds the threshold (default 10
from `site/data/self-eval-config.json`) is a candidate for this evolution.

If you're invoked manually for a single skill from a user request, skip this
step and go straight to step 4 with one phase id or `null`.

For each candidate phase, gather:

- Phase id, title, goal, pressure score
- All tasks in the phase (id, status, goal)
- Decisions referencing the phase
- File refs touched by the phase's tasks (from git history)
- `git log --follow --oneline <file>` for each touched file (catches the
  historical "three attempts at task X failed" thread that lives in commit
  history, not decision text)

Use the GAD CLI to pull these:

```sh
gad phases --projectid get-anything-done | grep "^get-anything-done  $PHASE_ID"
gad tasks --projectid get-anything-done | grep "^get-anything-done  $PHASE_ID-"
gad decisions --projectid get-anything-done | grep -i "phase $PHASE_ID"
```

## Step 4: Write CANDIDATE.md per candidate phase

For each candidate phase, write `skills/proto-skills/<slug>/CANDIDATE.md`. The
slug is `phase-<N>-<short-kebab-of-title>`.

CANDIDATE.md is a structured raw dump:

```markdown
---
status: candidate
source_phase: 14
source_phase_title: "Eval framework — escape-the-dungeon + tracing"
pressure_score: 18
evolution_id: 2026-04-13-001
created_on: 2026-04-13
created_by: gad-evolution-evolve
---

# Candidate from phase 14

## Phase header
<raw `gad phases` line>

## Tasks
<raw `gad tasks` output for phase 14>

## Decisions touching this phase
<raw `gad decisions` output, filtered>

## File references
<file paths touched by this phase's commits, one per line>

## Git history for touched files
<git log --follow --oneline output for each file>

## CLI surface available
<paste relevant lines from `gad --help` and `gad <subcommand> --help`>

## Existing related skills
<output of `ls sdk/skills/` filtered to skills with overlapping keywords>
```

**No curator section.** No proposed name. No proposed test prompts. No
hand-picked decisions. The drafting agent (gad-quick-skill) reads this raw
material and decides what matters.

## Step 5: Invoke gad-quick-skill on each CANDIDATE.md

Hand each candidate off to `gad-quick-skill`:

```
For each <slug> in this evolution:
  Invoke gad-quick-skill with: "Process the candidate at
  skills/proto-skills/<slug>/CANDIDATE.md. Write SKILL.md + references/
  in the same directory. Do not ask questions."
```

If you have access to spawning subagents, run multiple in parallel — one per
candidate. Otherwise run them in series.

## Step 6: Invoke gad-evolution-validator on each new proto-skill

After SKILL.md is written, hand the proto-skill to `gad-evolution-validator`:

```
For each <slug>:
  Invoke gad-evolution-validator with: "Validate skills/proto-skills/<slug>/SKILL.md
  against the actual repo. Write VALIDATION.md flagging file refs that don't
  exist, CLI commands that don't match `gad --help`, and convention shapes
  that diverge from existing files."
```

VALIDATION.md is advisory. It does not block promotion. The human reviewer
reads it alongside SKILL.md.

## Step 7: Register a single review task

After all proto-skills are drafted and validated, register **one** task in
TASK-REGISTRY for the whole evolution batch. Don't create one task per
proto-skill — that's bookkeeping bloat. The proto-skills dir IS the work list.

```
Task: Review evolution <evolution-id> proto-skills
Status: planned
Goal: Open skills/proto-skills/<slug>/SKILL.md for each pending proto-skill,
read its VALIDATION.md, then run `gad evolution promote <slug>` or
`gad evolution discard <slug>`. Evolution closes automatically when the
proto-skills dir is empty.
Skill: gad-evolution-evolve
Type: framework
```

## Step 8: Print summary

```
Evolution 2026-04-13-001 started.
  Drafted: 5 proto-skills
  Pending review: 5

Open the SKILL.md for each in your editor:
  skills/proto-skills/<slug-1>/SKILL.md
  skills/proto-skills/<slug-2>/SKILL.md
  ...

Then promote or discard each:
  gad evolution promote <slug>
  gad evolution discard <slug>

Run `gad status` to see remaining proto-skills at any time.
```

## Failure modes

- **Pending proto-skills blocking evolve:** intentional. If you really need to
  start fresh, manually `rm -rf skills/proto-skills/*` and accept that work
  is lost. There's no `--force` flag because forcing this defeats the gate.
- **No high-pressure phases found:** valid outcome. Print "no proto-skills
  this evolution" and don't create any files. The evolution marker still
  drops in `.evolutions/` so we have a record that we looked.
- **gad-quick-skill produces a sparse SKILL.md:** read CANDIDATE.md, see if it
  was sparse. The CANDIDATE.md should always include the full task list,
  decisions, file refs, and git history. If those are missing, fix the
  CANDIDATE.md generation in step 4.

## Reference

- `gad-quick-skill` — the drafter this skill invokes per candidate
- `gad-evolution-validator` — the advisory checker
- `compute-self-eval.mjs` — selection pressure source
- `evals/FINDINGS-2026-04-13-evolution-loop-experiment.md` — why the curator
  was dropped
- Roadmap phase 42 — the design context
