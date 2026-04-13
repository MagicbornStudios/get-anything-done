---
name: gad-evolution-evolve
description: >-
  Start a new evolution of the GAD framework — analyze high-pressure phases,
  identify skill candidates, write a complete INTENT.md context payload for
  each, and hand them off to gad-skill-creator for autonomous test-and-draft.
  Use when the user says "let's evolve", "run an evolution", "find new skills",
  "what skills should we add", or after closing a milestone where you want to
  capture lessons. An evolution is the primary mechanism by which GAD's species
  (its DNA / skill set) improves between milestones. Refuses to run if any
  pending candidates from a previous evolution still need human review — clear
  the queue first.
---

# gad-evolution-evolve

Drives one round of the GAD evolution loop. Every evolution produces a batch of
**skill candidates** that must be reviewed by a human before they become real
skills.

## Mental model

> A species' identity = its DNA = its installed skill set.
> Evolving the species means evolving the skill set.
> An evolution is one batch of proposed skill changes.

The loop:

```
gad:evolution:evolve
  ├─ pressure analysis (existing compute-self-eval.mjs)
  ├─ for each high-pressure phase that doesn't already have a skill:
  │     ├─ build INTENT.md from phase tasks/decisions/refs
  │     ├─ invoke gad-skill-creator on the INTENT
  │     └─ skill-creator writes SKILL.md + evals + viewer.html
  └─ register a single TASK-REGISTRY task: "Review evolution <id> candidates"

(human, async)
  opens skills/candidates/<slug>/viewer.html for each candidate
  → submits feedback → reviewer decides per-candidate

gad evolution promote <slug>     ← moves to sdk/skills/
gad evolution discard <slug>     ← deletes the candidate
```

The next `gad:evolution:evolve` cannot run until every candidate from the
current evolution is either promoted or discarded.

## Step 1: Refuse to start if there's a pending evolution

```sh
PENDING=$(ls skills/candidates 2>/dev/null | wc -l)
if [ "$PENDING" -gt 0 ]; then
  echo "Cannot start a new evolution — $PENDING candidates still pending review."
  echo "Run 'gad status' to see them, then promote or discard each before evolving again."
  exit 1
fi
```

This is the human-review gate. It exists because evolutions accumulating without
review just rot.

## Step 2: Generate an evolution id

```sh
EVOLUTION_ID="$(date +%Y-%m-%d)-$(printf '%03d' $(( $(ls skills/.evolutions 2>/dev/null | wc -l) + 1 )))"
mkdir -p skills/.evolutions
touch "skills/.evolutions/$EVOLUTION_ID"
```

The empty marker file lets `gad status` and the site know an evolution started
on this date even after all its candidates are reviewed and gone.

## Step 3: Run pressure analysis to find candidate phases

The existing self-eval pipeline already identifies high-pressure phases:

```sh
node site/scripts/compute-self-eval.mjs --emit-candidates --threshold 10
```

This writes a list of phase ids whose pressure score exceeds the threshold and
that don't yet have a skill associated. Each is a candidate. (If you're invoked
manually for a single skill from a user request, skip this step and go straight
to step 4 with one phase id or `null`.)

For each candidate phase, gather:

- Phase id, title, goal, pressure score
- All tasks in the phase (id, status, goal)
- Decisions referencing the phase
- File refs touched by the phase's tasks (from git history)
- Errors / failed attempts (from `.gad-log/` and the phase's commits)

Use the GAD CLI to pull these:

```sh
gad phases --projectid get-anything-done | grep "^get-anything-done  $PHASE_ID"
gad tasks --projectid get-anything-done | grep "^get-anything-done  $PHASE_ID-"
gad decisions --projectid get-anything-done | grep -i "phase $PHASE_ID"
```

## Step 4: Write INTENT.md per candidate

For each candidate phase, propose a kebab-case skill name and write
`skills/candidates/<slug>/INTENT.md` following the format defined in
`gad-skill-creator`. The INTENT must be complete enough that skill-creator
needs zero clarification.

Critical: the **test prompts** in INTENT.md must be drawn from real tasks in
the source phase. Skill-creator uses them verbatim as evaluation prompts, so
they have to be realistic things a user would actually say — not abstracted
descriptions.

Also write the evolution id into the INTENT frontmatter:

```yaml
---
status: candidate
source_phase: 14
source_phase_title: "Eval framework — escape the dungeon tracing"
pressure_score: 18
evolution_id: 2026-04-13-001
created_on: 2026-04-13
created_by: gad-evolution-evolve
proposed_name: trace-aware-eval-runner
---
```

## Step 5: Invoke gad-skill-creator on each INTENT

Hand each candidate off to `gad-skill-creator`:

```
For each <slug> in this evolution:
  Invoke gad-skill-creator with: "Process the candidate at
  skills/candidates/<slug>/. The INTENT.md is complete; do not ask questions."
```

If you have access to spawning subagents, run multiple in parallel — one per
candidate. Otherwise run them in series. Skill-creator's own test runs are
already parallelized internally so we don't lose much by serializing the
outer loop.

## Step 6: Register a single review task

After all candidates are drafted, register **one** task in TASK-REGISTRY for
the whole evolution batch. Don't create one task per candidate — that's
bookkeeping bloat. The candidates dir IS the work list.

```
Task: Review evolution <evolution-id> candidates
Status: planned
Goal: Open skills/candidates/<slug>/viewer.html for each pending candidate,
review the test results, then run `gad evolution promote <slug>` or
`gad evolution discard <slug>` on each. Evolution closes automatically when
the candidates dir is empty.
Skill: gad-evolution-evolve
Type: framework
```

## Step 7: Print summary

```
Evolution 2026-04-13-001 started.
  Drafted: 5 candidates
  Pending review: 5

Open the viewers in a browser to review each:
  skills/candidates/<slug-1>/viewer.html
  skills/candidates/<slug-2>/viewer.html
  ...

Then promote or discard each:
  gad evolution promote <slug>
  gad evolution discard <slug>

Run `gad status` to see remaining candidates at any time.
```

## Why no attempt-evolution / finish-evolution skills

Earlier sketches of this loop had three commands (evolve / attempt-evolution /
finish-evolution). We collapsed to one because:

1. **Testing happens inside skill-creator.** It runs the eval loop natively
   (with-skill + baseline subagents, grading, benchmarking, viewer). We don't
   need a separate `attempt-evolution` skill to do what skill-creator already
   does better.
2. **Finishing happens by file move.** Promote = `git mv` from candidates/ to
   sdk/skills/. Discard = `rm -rf`. Both are one-line CLI commands, not skills.
3. **The evolution closes itself.** When the candidates dir is empty, the
   evolution is done. No separate "finish" gesture required.

## Failure modes

- **Pending candidates blocking evolve:** intentional. If you really need to
  start fresh, manually `rm -rf skills/candidates/*` and accept that work is
  lost. There's no `--force` flag because forcing this defeats the gate.
- **INTENT.md too sparse:** skill-creator will start asking questions. Symptom:
  the run hangs waiting for input. Fix: make INTENT.md richer, especially the
  test prompts and CLI surface sections.
- **No high-pressure phases found:** valid outcome. Print "no candidates this
  evolution" and don't create any files. The evolution marker still drops in
  `.evolutions/` so we have a record that we looked.

## Reference

- `gad-skill-creator` — the wrapper this skill invokes per candidate
- `compute-self-eval.mjs` — pressure analysis source
- Roadmap phase 42 — the design context for this whole loop
