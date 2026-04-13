---
name: gad-evolution-validator
description: >-
  Run the advisory validator on a proto-skill and write VALIDATION.md alongside
  its SKILL.md. The validator extracts file references and `gad <subcommand>`
  CLI commands cited in the SKILL.md, then checks each against the actual repo
  — flagging files that don't exist and CLI commands that don't appear in
  `gad --help`. The output is ADVISORY, not blocking — the human reviewer
  reads VALIDATION.md alongside SKILL.md before promoting or discarding the
  proto-skill. Use when `gad-evolution-evolve` finishes drafting a proto-skill,
  or any time you want to validate an existing proto-skill in
  `skills/proto-skills/<slug>/`.
---

# gad-evolution-validator

Wraps the `gad evolution validate` CLI command, which reads a proto-skill
SKILL.md and writes a sibling VALIDATION.md flagging things the skill cites
that don't actually exist in the repo today.

## Mental model

A proto-skill is a draft. The drafting agent (gad-quick-skill) reads raw
candidate data and writes a SKILL.md based on what it understood. The
validator runs after drafting and answers a single question:

> Does this skill reference things that actually exist in the repo right now?

It's a sanity check, not a rule check. The skill might prescribe a structure
the repo hasn't adopted yet — that's fine for forward-looking skills, but the
human reviewer should see the discrepancy before promoting.

## When to use this

- `gad-evolution-evolve` calls this immediately after `gad-quick-skill` writes
  a new proto-skill.
- A user asks "validate proto-skill X" or "check if this skill is consistent
  with the repo."
- You want to re-validate after editing a proto-skill by hand.

## What the validator checks (v1)

| Check | How |
|---|---|
| File references | Greps the SKILL.md for backticked / quoted paths containing slashes + extensions, then checks each against the repo root and `vendor/get-anything-done/`. |
| CLI commands | Greps for `gad <subcommand>` patterns, then checks each against `gad --help`'s top-level command list. |

What it does NOT check (yet):
- JSON shape consistency (e.g. does the skill's example `gad.json` match real ones?)
- Naming consistency with existing conventions
- Whether the skill's recipe actually runs end-to-end

These are deferred until needed.

## Step 1 — Run the validator

```sh
gad evolution validate <slug>
```

Where `<slug>` is the directory name under `skills/proto-skills/`. The
command writes `skills/proto-skills/<slug>/VALIDATION.md` and prints a
summary line with pass counts.

## Step 2 — Read the output

Open `skills/proto-skills/<slug>/VALIDATION.md`. It has three sections:

1. **Summary** — pass/fail counts per check
2. **File references** — table of every cited path with ✓ or ✗
3. **CLI commands** — table of every cited `gad <cmd>` with ✓ or ✗

If everything passes, the proto-skill is internally consistent with the repo
and is ready for human review. If items fail, investigate before recommending
promotion.

## Step 3 — Decide what to do with failures

The validator is advisory, so failures don't block promotion. But they're a
signal to investigate:

- **Forward-looking reference** (e.g. the skill cites a file that doesn't
  exist yet because the skill is documenting something still being built):
  fine, leave it. The human reviewer should know.
- **Wrong path / typo**: edit the SKILL.md by hand to fix the path, then
  re-run validate.
- **Invented CLI command**: edit the SKILL.md to drop the bogus command, or
  if the command genuinely should exist, log a follow-up to add it.
- **Dozens of failures**: the proto-skill is likely hallucinating. Discard
  with `gad evolution discard <slug>` and let the next evolution try again
  with a richer CANDIDATE.md.

## Failure modes

- **Validator finds nothing because the SKILL.md uses prose instead of
  backticked references.** If a path is mentioned only in narrative form
  (e.g. "the file at vendor/get-anything-done/lib/trace-schema.cjs"), the
  v1 regex won't pick it up. This is fine — the validator catches
  *backticked* references, which are the load-bearing ones the agent
  intends as commands. Prose references aren't actionable anyway.

- **CLI command extraction misses subcommands.** The validator only checks
  the top-level command (e.g. `gad evolution`, not `gad evolution validate`).
  For now this is acceptable — if the top-level command exists, the
  subcommand is usually findable by drilling in.

## Reference

- `lib/evolution-validator.cjs` — the validator engine
- `gad evolution validate <slug>` — the CLI entry point
- `gad-evolution-evolve` — the orchestrator that calls this
- `gad-quick-skill` — the drafter whose output this validates
