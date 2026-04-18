---
name: create-proto-skill
description: >-
  Bulk drafter for proto-skills inside the GAD evolution loop. Enumerates
  every raw candidate under `.planning/candidates/`, filters to ones that
  don't yet have a finished proto-skill bundle at `.planning/proto-skills/
  <slug>/`, and drafts each pending candidate in turn. Per-candidate
  checkpoint protocol: write PROVENANCE.md FIRST as a lock marker, then
  workflow.md, then SKILL.md — so a crash or context compaction mid-batch
  leaves half-written bundles identifiable and resumable on the next run.
  Triggers on "draft a skill", "draft proto-skills", "convert candidates
  to proto-skills", or whenever `gad:evolution:evolve` invokes the
  drafting step. Output bundles follow decision gad-191: SKILL.md with
  `status: proto` + `workflow: ./workflow.md`, sibling workflow.md,
  PROVENANCE.md, optional CANDIDATE.md copy. For high-stakes skills that
  need real test runs, use `gad-skill-creator` (heavy path) instead.
lane: meta
status: stable
---

# create-proto-skill

The lightweight drafter inside the GAD evolution loop. Walks every raw
candidate under `.planning/candidates/`, drafts each one into a proto-skill
bundle under `.planning/proto-skills/<slug>/`, and hands off to
`gad evolution validate` and `gad evolution install` for advisory scoring
and runtime test use.

Renamed from `gad-quick-skill` per decision gad-168. Output shape locked by
decision gad-191. Bulk-batch + per-candidate-checkpoint protocol locked by
decision gad-171 — the whole point is that a 20-candidate batch survives a
crash or auto-compact halfway through.

## When to use this skill

- `gad:evolution:evolve` calls this during the drafting step for every
  candidate that `compute-self-eval` surfaced above the pressure threshold.
- A user says "draft a proto-skill for X", "convert this candidate", or
  "draft all pending candidates".
- You've finished a workflow and want to capture a SKILL.md immediately
  without running `gad-skill-creator`'s full eval loop.
- You have clear context sources — CANDIDATE.md files from self-eval, raw
  phase dumps, or working session notes you want to preserve.

## When NOT to use this

- The skill is high-stakes and you want real subagent test runs to validate
  it — use `gad-skill-creator` (heavy path).
- You're improving an existing skill that already has tests — use
  `gad-skill-creator`, it re-runs the tests.
- The pattern isn't actually clear yet — write a quick note (`gad note`)
  and let the next evolution surface it.

## Draft quality bar — compartmentalized systems over captured answers

When drafting a proto-skill SKILL.md, default to the
**compartmentalized-system-as-skill** shape defined in
`skills/create-skill/SKILL.md` (§ The quality bar). In short:

1. Open the SKILL.md with a **requirements contract** — 3-6 falsifiable items
   the host system must satisfy. Not pseudocode, not tech-stack-specific —
   checkable contract items.
2. Name the **UX or behavior pattern** the skill instantiates on the host.
3. Note any preconditions the skill itself enforces (dev gate, runtime,
   eval condition, lane).
4. Keep examples anchored in one concrete host, but write the contract so
   it survives porting to a different host.

The canonical reference is `skills/gad-visual-context-system/SKILL.md`
(first proto-skill to prove the pattern). Model the drafted SKILL.md
against it when the candidate is clearly a repeatable system pattern and
not just a captured answer. If the candidate is a one-off fix recipe,
default to the lighter "captured-answer" shape (When to use / The pattern /
Why / Failure modes / Related) and skip the requirements contract.

The validator (`gad-evolution-validator`) reports advisory file-ref checks,
not quality-bar checks — compartmentalized-system review is a drafting-
time concern, not a post-hoc audit.

## Step 1 — enumerate pending candidates

Run `gad evolution status` first to see the current state. The command
renders three counts for the proto-skill backlog:

- **pending** — candidates under `.planning/candidates/<slug>/` with no
  matching `.planning/proto-skills/<slug>/` directory at all.
- **in-progress** — proto-skill dirs with PROVENANCE.md but no SKILL.md
  yet (a previous run crashed or was compacted mid-draft, lock marker left
  behind).
- **complete** — proto-skill dirs with both PROVENANCE.md and SKILL.md.

Your batch is `pending ∪ in-progress`. Skip `complete`.

Enumerate explicitly:

```sh
gad evolution status
# Or, to get the raw list:
ls .planning/candidates/
ls .planning/proto-skills/
```

For each candidate slug, decide its state:

- PROVENANCE.md missing → **pending** (fresh draft)
- PROVENANCE.md present, SKILL.md missing → **in-progress** (resume; keep
  the existing PROVENANCE.md, do not rewrite)
- Both present → **complete** (skip)

## Step 2 — ensure dot-agent create-skill is installed

Idempotent — only installs if missing:

```sh
if [ ! -d "$HOME/.agents/skills/create-skill" ]; then
  npx --yes skills add https://github.com/siviter-xyz/dot-agent --skill create-skill --global --yes
fi
```

After install, `~/.agents/skills/create-skill/SKILL.md` is the canonical
authoring guide plus four reference files in `references/`. Read SKILL.md
once for the format rules — this wrapper only handles input plumbing and
the checkpoint protocol.

## Step 3 — per-candidate checkpoint protocol

Loop over the pending+in-progress list. For each slug, **in this order**:

### 3a. Write PROVENANCE.md FIRST (lock marker)

Create `.planning/proto-skills/<slug>/` and write PROVENANCE.md before
anything else. This is the lock marker that tells the next run "this slug
is in-progress, don't re-draft it from scratch":

```markdown
---
candidate_slug: <slug>
source_phase: <phase id from CANDIDATE.md frontmatter>
pressure_score: <from CANDIDATE.md>
created_on: <YYYY-MM-DD>
created_by: create-proto-skill
status: in-progress
---

# Provenance for <slug>

Drafted from `.planning/candidates/<slug>/CANDIDATE.md` during evolution
turn <N>. Raw source: self-eval pressure dump (tasks, decisions, file refs,
CLI surface, related skills).
```

If PROVENANCE.md already exists (resume case), **do not overwrite it**.
Read its `status:` field — if `in-progress`, you're resuming a crashed run.

### 3b. Read the candidate

Read `.planning/candidates/<slug>/CANDIDATE.md`. It contains the raw phase
dump and is **not curated** — no proposed name, no hand-picked decisions,
no suggested test prompts. Decide what matters. This is intentional per the
2026-04-13 evolution-loop experiment finding: curators filter, raw input
pulls in more decisions.

For direct user requests where no candidate exists, write a minimal
CANDIDATE.md into `.planning/candidates/<slug>/` from whatever the user is
pointing at, then continue.

### 3c. Write workflow.md

Write the procedural body to `.planning/proto-skills/<slug>/workflow.md`.
This is the "what the agent actually does" file — step-by-step instructions,
guardrails, failure modes. Follow dot-agent's authoring rules: imperative
form, explain *why* not just *what*, split deeper content into
`references/<file>.md` and reference from here.

Pick the kebab-case skill name yourself, drawing from the phase or context.
Do not ask the human. The autonomous loop exists because you make the call.

### 3d. Write SKILL.md (thin entry point)

Write `.planning/proto-skills/<slug>/SKILL.md` as the thin trigger doc with
`workflow: ./workflow.md` per decision gad-191:

```markdown
---
name: <skill-name>
description: >-
  <2-4 sentence trigger-friendly description. Start strong. Include the
  "when to use" framing so it fires reliably.>
status: proto
workflow: ./workflow.md
---

# <skill-name>

<One-paragraph summary. Point the reader at workflow.md for the procedure.>

**Workflow:** [./workflow.md](./workflow.md)

## Provenance

Drafted by `create-proto-skill` from `.planning/candidates/<slug>/
CANDIDATE.md` on <date>. See PROVENANCE.md for source metadata.
```

Hard rule: **SKILL.md under 200 lines.** If the body is long, move it to
workflow.md and keep SKILL.md as the trigger-only entry point.

### 3e. Flip PROVENANCE.md status to `complete`

After both workflow.md and SKILL.md land, update PROVENANCE.md `status:`
from `in-progress` to `complete`. This closes the lock marker.

### 3f. Commit checkpoint (if in a long batch)

For batches over ~5 candidates, commit after each completed proto-skill so
partial progress survives independent of the working tree. Commit message
shape: `evolution: draft proto-skill <slug> from candidate`.

## Step 4 — hand off to the validator

After the batch finishes, the orchestrator (`gad:evolution:evolve`) runs
`gad-evolution-validator` across the new proto-skills. The validator writes
`.planning/proto-skills/<slug>/VALIDATION.md` with advisory notes:

- Files cited in SKILL.md/workflow.md that don't exist in the repo
- CLI commands cited that don't appear in `gad --help`
- Convention shapes that don't match existing files

VALIDATION.md is **advisory, not blocking**. The human reviewer reads
SKILL.md + workflow.md + VALIDATION.md before promote/discard. You don't
need to act on validator output — just leave the proto-skills in place.

## Step 5 — stop

Do not iterate. Do not run test prompts. Do not ask for review. Proto-skills
stay in `.planning/proto-skills/<slug>/` until a human runs
`gad evolution install <slug>`, `gad evolution promote <slug>`, or
`gad evolution discard <slug>` later.

## Resume protocol (crash / auto-compact recovery)

If you're invoked after a previous batch crashed mid-draft:

1. Run `gad evolution status` — the `in-progress` count is your work queue.
2. For each in-progress slug, read the existing PROVENANCE.md to confirm
   it's a lock marker, not a false positive.
3. Resume at step 3b (re-read the candidate, then 3c → 3d → 3e).
4. Never regenerate PROVENANCE.md on resume — the original timestamp and
   metadata are part of the audit trail.

## Failure modes

- **dot-agent guide says to ask the user questions.** Don't. Make the call
  yourself, document the decision in workflow.md. Autonomous loop.
- **Tempted to run test prompts.** That's `gad-skill-creator` territory.
  Stop at SKILL.md + workflow.md.
- **CANDIDATE.md is sparse.** Read it anyway and pull from the file
  references it points at — that's where the depth lives.
- **Forgot to write PROVENANCE.md first.** Re-run from step 3a for that
  slug. The checkpoint protocol is not decorative; without a lock marker,
  crash-resume can't distinguish "never started" from "half-done".
- **Existing `.planning/proto-skills/<slug>/` from a prior run.** Inspect
  before overwriting: `complete` means skip, `in-progress` means resume.

## Reference

- `~/.agents/skills/create-skill/SKILL.md` — dot-agent authoring guide
- `references/skill-shape.md` — uniform shape contract
- `references/proto-skills.md` — proto-skill bundle contract
- `gad-skill-creator` — heavy path with full eval loop
- `gad-evolution-evolve` — orchestrator that calls this in a batch
- Decision gad-171 — bulk batching + per-candidate checkpoints
- Decision gad-191 — proto-skill bundle shape at `.planning/proto-skills/`
- 2026-04-13 evolution-loop experiment finding
  (`evals/FINDINGS-2026-04-13-evolution-loop-experiment.md`)
