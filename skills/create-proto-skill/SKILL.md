---
name: create-proto-skill
description: >-
  Fast path to draft a proto-skill from a candidate context file or raw
  materials. Lightweight authoring guide — no eval loop, no benchmarks, no
  test runs — ideal when you have clear context and just need to write a
  clean proto-skill bundle following the uniform shape in
  references/skill-shape.md. Triggers on "draft a skill", "create proto
  skill", "write a skill from this", "convert this candidate to a skill",
  or whenever `gad:evolution:evolve` invokes the drafting step. Output
  lands at `.planning/proto-skills/<slug>/` per decisions gad-183 and
  gad-191 as a self-contained bundle (SKILL.md + sibling workflow.md +
  PROVENANCE.md). For high-stakes skills that need real test runs and
  iteration, use `gad-skill-creator` (the heavy path) instead — but
  proto-skill drafting is the right default for candidates coming out of
  the evolution loop.
status: stable
---

# create-proto-skill

The lightweight drafter inside the GAD evolution loop. Reads a candidate
context file, writes a proto-skill bundle to `.planning/proto-skills/<slug>/`,
and hands off to `gad evolution validate` for advisory scoring and
`gad evolution install` for runtime test use. Renamed from `gad-quick-skill`
per decision gad-168; output contract updated to the proto-skill bundle
shape per decision gad-191.

We use the dot-agent skill **unmodified** — it's already a clean format guide
that enforces the 200-line rule, the progressive disclosure principle, and the
references/ split. We take ownership of how it's invoked inside the GAD loop.

## When to use this skill

- `gad:evolution:evolve` calls this for each high-pressure phase candidate.
- A user explicitly says "draft a skill for X" or "quick skill" or "convert
  this candidate to a skill."
- You've finished a workflow and want to capture a SKILL.md immediately
  without running through `gad-skill-creator`'s eval loop.
- You have a clear context source — a CANDIDATE.md from compute-self-eval,
  a raw phase dump, or a working session you want to preserve.

## When NOT to use this

- The skill is high-stakes and you want test runs against real subagents to
  validate it — use `gad-skill-creator` (heavy path) instead.
- You're improving an existing skill that already has tests — `gad-skill-creator`
  knows how to read the existing tests and re-run them.
- The pattern isn't actually clear yet — write a quick note instead and let
  the next evolution surface it.

## Step 1 — ensure dot-agent create-skill is installed

Idempotent — only installs if missing:

```sh
if [ ! -d "$HOME/.agents/skills/create-skill" ]; then
  npx --yes skills add https://github.com/siviter-xyz/dot-agent --skill create-skill --global --yes
fi
```

After install, `~/.agents/skills/create-skill/SKILL.md` is the canonical source
plus four reference files in `references/`. Read SKILL.md once for the full
authoring guide — this wrapper only handles the input plumbing.

## Step 2 — locate the source context

The drafting input depends on how you were invoked:

- **From `gad:evolution:evolve`:** `skills/candidates/<slug>/CANDIDATE.md` — already
  exists, written by `compute-self-eval`. Contains the raw phase dump (tasks,
  decisions, file refs, CLI surface, related skills, git log highlights).
- **From a direct user request:** decide on a kebab-case slug, create
  `.planning/proto-skills/<slug>/`, and write a CANDIDATE.md from whatever the
  user is pointing at (a phase, a working session, a transcript, a file).
- **From a "redraft this skill" request:** the existing skill's directory.

The CANDIDATE.md is **not curated** and does not contain a proposed name,
proposed test prompts, or hand-picked decisions. It's the raw source. The
agent reads it and decides what matters. This is intentional — see the
2026-04-13 evolution-loop experiment finding: curators are filters, raw input
pulls in more decisions.

## Step 3 — invoke dot-agent create-skill on the source

Read `~/.agents/skills/create-skill/SKILL.md` and follow its authoring
workflow, treating CANDIDATE.md (or the user's context) as the source. The
key constraints from dot-agent's guide:

- **SKILL.md must be under 200 lines** — hard rule.
- Description should be appropriately "pushy" so the skill triggers reliably.
- Split deeper content into `references/<file>.md` and reference from SKILL.md.
- Use the imperative form in instructions.
- Explain *why*, not just *what*.

Write to `.planning/proto-skills/<slug>/SKILL.md` and any references files under
`.planning/proto-skills/<slug>/references/`.

Pick the kebab-case skill name yourself, drawing from the phase or context. Do
not ask the human — the whole point of the autonomous loop is that you make
the call.

## Step 4 — Hand off to the validator

After SKILL.md is written, the orchestrator (`gad:evolution:evolve`) runs the
validator skill (`gad-evolution-validator`) on the new proto-skill. The
validator writes `.planning/proto-skills/<slug>/VALIDATION.md` with advisory
notes:

- Files cited in SKILL.md that don't exist in the repo
- CLI commands cited that don't appear in `gad --help`
- Convention shapes (e.g. `gad.json` examples) that don't match existing
  files in the repo

VALIDATION.md is **advisory, not blocking**. The human reviewer reads both
SKILL.md and VALIDATION.md before promote/discard. You don't need to act on
the validator yourself — just leave the proto-skill in place.

## Step 5 — Stop

Do not iterate. Do not run test prompts. Do not ask for review. The
proto-skill stays in `.planning/proto-skills/<slug>/` until a human runs
`gad evolution install <slug> ...`, `gad evolution promote <slug>`, or
`gad evolution discard <slug>` later.

If the orchestrator passed you multiple candidates, loop steps 2-4 for each
one. Otherwise stop after one.

## Failure modes

- **dot-agent guide says to ask the user questions.** Don't. Make the call
  yourself and document the decision in the skill body. We're autonomous
  here.
- **Tempted to run test prompts.** That's `gad-skill-creator` territory. Stop
  at SKILL.md.
- **CANDIDATE.md is sparse.** Read it anyway and pull from the file references
  it points at — that's where the depth lives.

## Why this skill is universal (not under `gad:evolution:`)

Quick-skill is useful outside the evolution loop too — anytime you want to
write a skill fast from clear context. Keeping it general means we don't
duplicate the wrapper for one-off skill authoring vs evolution drafting.

## Reference

- `~/.agents/skills/create-skill/SKILL.md` — dot-agent's canonical authoring guide
- `~/.agents/skills/create-skill/references/*` — format, structure, examples, best practices
- `gad-skill-creator` — the heavy path with full eval loop (Anthropic skill-creator)
- `gad-evolution-evolve` — the orchestrator that calls this for each candidate
- 2026-04-13 evolution-loop experiment finding (`evals/FINDINGS-2026-04-13-evolution-loop-experiment.md`)
