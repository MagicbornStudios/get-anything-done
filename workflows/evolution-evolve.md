<workflow slug="evolution-evolve" name="Run one GAD evolution cycle">

<objective>
Drive one round of the GAD evolution loop: refuse to start if pending
proto-skills exist, find high-pressure phases via selection pressure,
write one CANDIDATE.md per phase, draft a proto-skill per candidate,
validate each, and register a human-review task. Every evolution
produces a batch of proto-skills that must be reviewed before the
next cycle can run.
</objective>

<inputs>
  <param name="projectid" type="string" required="true">GAD project id (e.g. get-anything-done)</param>
</inputs>

<outputs>
  <file>.planning/candidates/&lt;slug&gt;/CANDIDATE.md (per high-pressure phase)</file>
  <file>.planning/proto-skills/&lt;slug&gt;/SKILL.md + workflow.md + PROVENANCE.md (per candidate)</file>
  <file>.planning/proto-skills/&lt;slug&gt;/VALIDATION.md (per proto-skill)</file>
  <file>skills/.evolutions/&lt;evolution-id&gt; marker</file>
  <metric name="candidates_created" type="int"/>
  <metric name="proto_skills_drafted" type="int"/>
  <metric name="proto_skills_validated" type="int"/>
</outputs>

<process>

<step id="1" name="gate" tool="gad skill list --proto">
Refuse to start if `.planning/proto-skills/` is non-empty. This is the
human-review gate — evolutions accumulating without review just rot.
Print the pending list and exit non-zero if any exist.
</step>

<branch if="pending_proto_skills.length > 0">
  <step id="1a" name="exit-with-pending">Print pending proto-skills and exit non-zero.</step>
</branch>

<else>
  <step id="2" name="generate-evolution-id" tool="bash">
    Generate `EVOLUTION_ID = YYYY-MM-DD-NNN` and touch the marker file
    at `skills/.evolutions/&lt;id&gt;`.
  </step>

  <step id="3" name="compute-selection-pressure" tool="node site/scripts/compute-self-eval.mjs" output="high_pressure_phases">
    Run compute-self-eval to populate `site/data/self-eval.json`. Read
    the `high_pressure_phases` array for phases exceeding the pressure
    threshold.
  </step>

  <branch if="high_pressure_phases.length == 0">
    <step id="3a" name="exit-no-candidates">No pressure → no candidates → exit cleanly with the current evolution id recorded.</step>
  </branch>

  <else>
    <loop for="phase in high_pressure_phases" id="candidate-loop">
      <step id="4" name="write-candidate" tool="fs.write" output="candidate_path">
        Write `.planning/candidates/&lt;slug&gt;/CANDIDATE.md` — a raw phase
        dump (tasks, decisions, file refs, CLI surface, git log) with
        NO curator pre-digestion. See "Why no curator step" note below.
      </step>
    </loop>

    <loop for="candidate in candidates" id="draft-loop">
      <step id="5" name="lock" tool="fs.write">
        Write `.planning/proto-skills/&lt;slug&gt;/PROVENANCE.md` FIRST as a
        lock marker (candidate slug, phase id, pressure metrics,
        timestamp). Lets the loop resume on crash.
      </step>

      <step id="6" name="draft" skill="create-proto-skill" output="proto_skill_path">
        Invoke create-proto-skill on the candidate. Writes SKILL.md +
        sibling workflow.md to the bundle directory.
      </step>

      <step id="7" name="validate" skill="gad-evolution-validator" output="validation_path">
        Run the advisory validator. Writes VALIDATION.md alongside
        SKILL.md. Advisory only — does not block the loop.
      </step>
    </loop>

    <step id="8" name="register-review-task" tool="gad task add">
      Register one TASK-REGISTRY task: "Review evolution &lt;id&gt;
      proto-skills". The next `gad evolution evolve` cannot run until
      that task is closed.
    </step>
  </else>
</else>

</process>

<references>
  <ref>skills/create-proto-skill/SKILL.md — drafter invoked per candidate</ref>
  <ref>skills/gad-evolution-validator/SKILL.md — advisory validator</ref>
  <ref>site/scripts/compute-self-eval.mjs — selection-pressure computation</ref>
  <ref>references/proto-skills.md — proto-skill contract and lifecycle</ref>
  <ref>references/skill-shape.md §11 — full lifecycle diagram</ref>
  <ref>evals/FINDINGS-2026-04-13-evolution-loop-experiment.md — curator vs raw data finding</ref>
  <ref>decision gad-171 — bulk batching with per-candidate checkpoints</ref>
  <ref>decision gad-183 — proto-skills stage inside .planning/</ref>
</references>

</workflow>

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
  │     ├─ keep .planning/candidates/<slug>/CANDIDATE.md as the raw source
  │     │     = raw phase dump (no curator pre-digestion)
  │     ├─ invoke create-proto-skill on CANDIDATE.md
  │     │     → writes .planning/proto-skills/<slug>/SKILL.md + references/
  │     └─ invoke gad-evolution-validator on the new proto-skill
  │           → writes .planning/proto-skills/<slug>/VALIDATION.md (advisory)
  └─ register one TASK-REGISTRY task: "Review evolution <id> proto-skills"

(human review, async)
  reads SKILL.md + VALIDATION.md → promote or discard

gad skill promote <slug> --project --claude     ← consumer runtime install (any project)
gad skill promote <slug> --framework             ← canonical promote (this repo only; joins species DNA)
gad evolution discard <slug>                     ← deletes the proto-skill

(Legacy: `gad evolution install` / `gad evolution promote` still work as
back-compat shims and forward to the unified `gad skill promote` verb per
decision gad-188 / task 44-36.)
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
PENDING=$(ls .planning/proto-skills 2>/dev/null | wc -l)
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

For each candidate phase, keep `.planning/candidates/<slug>/CANDIDATE.md` as the raw source and write the staged proto-skill to `.planning/proto-skills/<slug>/`. The
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
<output of `ls skills/` filtered to skills with overlapping keywords>
```

**No curator section.** No proposed name. No proposed test prompts. No
hand-picked decisions. The drafting agent (create-proto-skill) reads this raw
material and decides what matters.

## Step 5: Invoke create-proto-skill on each CANDIDATE.md

Hand each candidate off to `create-proto-skill`:

```
For each <slug> in this evolution:
  Invoke create-proto-skill with: "Process the candidate at
  .planning/candidates/<slug>/CANDIDATE.md. Write SKILL.md + references/
  under .planning/proto-skills/<slug>/. Do not ask questions."
```

If you have access to spawning subagents, run multiple in parallel — one per
candidate. Otherwise run them in series.

## Step 6: Invoke gad-evolution-validator on each new proto-skill

After SKILL.md is written, hand the proto-skill to `gad-evolution-validator`:

```
For each <slug>:
  Invoke gad-evolution-validator with: "Validate .planning/proto-skills/<slug>/SKILL.md
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
Goal: Open .planning/proto-skills/<slug>/SKILL.md for each pending proto-skill,
read its VALIDATION.md, optionally run `gad skill promote <slug> --project [--claude|--codex|...]` to test it in a coding agent runtime, then run `gad skill promote <slug> --framework` (canonical) or
`gad evolution discard <slug>`. Evolution closes automatically when the
proto-skills dir is empty.
Skill: gad-evolution-evolve
Type: framework
```

## Step 8: Print review report (MANDATORY format)

Any turn that leaves `.planning/proto-skills/` non-empty MUST close with a full
review report in this format. Terse CLI pointers are not enough — the human
review gate rots when the report is vague. Feedback 2026-04-14: the user
explicitly wants per-slug walkthroughs with proposed name, file-tree shape,
merge-candidate analysis, and a recommended action.

### Top-of-report header

```
Evolution <id> — <pending> proto-skills pending review

Scope of this run:
  - <where was the evolution run: monorepo root / single project / manual staging>
  - <what pressure ranking was used / why these phases were picked>

Blocking: next `gad evolution evolve` cannot run until this queue is empty.
Tracked by task: <task-id for the review>
```

### Per-slug block (repeat for each pending proto-skill)

For every slug under `.planning/proto-skills/`, emit one block in this shape:

```
─── <N>. <slug> ───────────────────────────────────

Proposed skill name: <frontmatter `name` field>
Source: phase <N> / manual-staging / <other>
Validator:           <refs hit>/<refs total> file refs, <cli hit>/<cli total> CLI
Lines:               <SKILL.md wc -l>
Recommendation:      <PROMOTE | DISCARD | MERGE | EDIT-THEN-PROMOTE>

One-line purpose:
  <what the skill does, verb-led>

File tree:
  .planning/proto-skills/<slug>/
  ├── SKILL.md                  (<lines> lines)
  ├── VALIDATION.md             (advisory)
  └── references/               (if any)
      ├── <reference file 1>
      └── <reference file 2>

External references cited in SKILL.md:
  - <path>:<line>        <- one line each, relative to repo root
  - <path>:<line>
  - ...

Parent-skill / merge analysis:
  Parent candidates in skills/:
    - <existing-skill-name>     <- one-line reason this is a candidate
    - <existing-skill-name>     <- one-line reason
  Why <merge | keep-separate | deprecate-parent>:
    <2-3 sentences comparing scope, overlap, surface area>

Open and review:
  code .planning/proto-skills/<slug>/SKILL.md
  code .planning/proto-skills/<slug>/VALIDATION.md
  <if parent exists:>
  code skills/<parent-name>/SKILL.md

Commands to act on this slug:
  gad skill promote <slug> --project --claude    # try in runtime without committing
  gad skill promote <slug> --framework           # join canonical skills/ (this repo only)
  gad evolution discard <slug>                   # delete
```

### Recommendation values

- **PROMOTE** — validator clean, no parent overlap, ready to join `skills/`.
- **DISCARD** — validator failed, scope drifted, or the pattern isn't actually
  reusable. Name the reason in the recommendation.
- **MERGE** — a parent skill exists and the proto-skill should be folded into
  it. Always name the parent and explain the comparison.
- **EDIT-THEN-PROMOTE** — the proto-skill captures the right pattern but needs
  one more pass (rename slug, fix refs, tighten scope). Name the edit needed.

### Recommended review order

End the report with one paragraph on the order you suggest the user review the
slugs in. Highest-leverage first. Call out any blocking dependencies between
slugs (e.g. "review <A> before <B> because they might merge").

### Standard skill file shape

Every promoted skill follows the standard format with GAD-specific metadata:

```
---
name: <kebab-name>
description: >-
  Verb-led 1–3 sentence description with trigger phrases ("when user asks X", "use when Y").
source_phase: "<N>"              # optional, for evolved skills
source_evolution: <id>           # optional, for evolved skills
parent_skill: <name>             # optional, if superseding/extending another skill
status: proto | promoted         # proto while in .planning/proto-skills/, omit when promoted
---

# <skill title>

## When to use
<triggers, concrete phrases>

## Steps
<numbered, actionable>

## Failure modes
<concrete pitfalls>

## References
<file:line pointers to real repo paths. Freeform — skills may have a references/
directory with extracted doc/example files if the body needs more space.>
```

The `references/` subdirectory under a skill is **freeform but encouraged** —
use it for canonical snippets, design docs, comparison tables, or anything that
would bloat SKILL.md past ~200 lines. The validator counts `references/` files
against file-ref totals.

## Failure modes

- **Pending proto-skills blocking evolve:** intentional. If you really need to
  start fresh, manually clear `.planning/proto-skills/*` and accept that work
  is lost. There's no `--force` flag because forcing this defeats the gate.
- **No high-pressure phases found:** valid outcome. Print "no proto-skills
  this evolution" and don't create any files. The evolution marker still
  drops in `.evolutions/` so we have a record that we looked.
- **create-proto-skill produces a sparse SKILL.md:** read CANDIDATE.md, see if it
  was sparse. The CANDIDATE.md should always include the full task list,
  decisions, file refs, and git history. If those are missing, fix the
  CANDIDATE.md generation in step 4.

## Reference

- `create-proto-skill` — the drafter this skill invokes per candidate
- `gad-evolution-validator` — the advisory checker
- `compute-self-eval.mjs` — selection pressure source
- `evals/FINDINGS-2026-04-13-evolution-loop-experiment.md` — why the curator
  was dropped
- Roadmap phase 42 — the design context


