# Proto-skills

**Proto-skill** is a permanent skill type, not a transitional state.

A skill is a **proto-skill** when it was drafted by the evolution pipeline from pressure
signals in the project — usually a candidate from `compute-self-eval` — rather than
authored directly by a human using `gad-skill-creator`. The label stays with the skill
for its entire life. It is not removed after validation or promotion.

This is a deliberate departure from the earlier framing that treated proto-skills as a
short-lived intermediate between `skills/candidates/` and `skills/`. That framing
collapsed once we realized that provenance *is* a useful ongoing signal: a proto-skill's
lineage (which candidate, which phase, which pressure event) is how we evaluate whether
the evolution loop is producing skills worth keeping.

## Pipeline stages

```
pressure → candidate → proto-skill → proto-skill[validated] → proto-skill[promoted]
```

| Stage | Directory | What it is |
|---|---|---|
| candidate | `skills/candidates/<slug>/CANDIDATE.md` | Raw phase dump with pressure metrics and suggested intent |
| proto-skill (draft) | `skills/proto-skills/<slug>/SKILL.md` | A drafted skill in dot-agent format, not yet validated |
| proto-skill (validated) | `skills/proto-skills/<slug>/SKILL.md` + `VALIDATION.md` | Advisory validator has checked file refs, CLI commands, and shape |
| proto-skill (promoted) | `skills/<name>/SKILL.md` (with proto-skill provenance) | Skill is live and distributed — still carries its proto-skill origin in metadata |
| discarded | (deleted, candidate may remain) | Draft rejected; candidate returns to the queue if `--keepCandidate` |

## Why permanent

- **Provenance matters forever.** When a proto-skill starts misbehaving, the fastest
  triage is "which candidate did this come from, what pressure motivated it, and has
  that pressure reappeared?" That link only survives if the skill remembers it was
  born from the evolution loop.
- **Comparison data.** Proto-skills vs human-authored skills is a first-class eval
  axis for measuring whether the evolution loop produces competitive skills.
- **Trust calibration.** Downstream users can choose to trust human-authored skills
  differently from proto-skills until proto-skills accumulate usage data.

## The `create-proto-skill` workflow

The skill that drafts proto-skills is **`create-proto-skill`** (canonical name going
forward, replacing `gad-quick-skill`). `create-proto-skill` is a GAD-aware wrapper
around the neutral upstream skill creator; the neutral baseline stays available for
non-GAD use cases.

### Input contract

`create-proto-skill` reads a **candidate handoff** — a filesystem bundle, not a CLI
argument, so the skill can be batched across many candidates without context pressure:

```
skills/candidates/<slug>/
  CANDIDATE.md          # pressure dump + suggested intent (written by compute-self-eval)
  CONTEXT.md            # optional — additional context the candidate curator adds
  REFERENCES.md         # optional — file refs + CLI commands the skill should cite
```

Only `CANDIDATE.md` is required. The other two are progressive-disclosure additions
that let a human refine a candidate before it becomes a proto-skill draft.

### Output contract

For each candidate the skill is asked to process, it writes:

```
skills/proto-skills/<slug>/
  SKILL.md              # dot-agent format skill draft
  PROVENANCE.md         # candidate slug, phase id, pressure metrics, timestamp
```

`PROVENANCE.md` is how a promoted skill remembers it was born from the evolution loop.

### Batching

Because the handoff is filesystem-based, `create-proto-skill` can be invoked once
against all pending candidates in a single session — the skill reads each candidate
dir in turn, drafts the proto-skill, writes the files, moves on. This amortizes the
skill's context load (references, examples, format rules) across many drafts.

This is different from `gad-skill-creator`, which is human-in-the-loop, high-stakes,
and expects a single skill per invocation. `create-proto-skill` is bulk, low-stakes
(validator is advisory, human reviews before promotion), and optimized for throughput.

### Context hydration

`create-proto-skill` does NOT assume the caller pre-loaded any GAD context. If it
needs the project's current phase, decisions, or references, it pulls them via:

```sh
gad snapshot --projectid <id>
gad decisions --projectid <id>
gad phases --projectid <id>
```

The same way any GAD-aware agent hydrates.

## Validator

The validator (`gad evolution validate <slug>`) is **advisory**, not gating
(decision gad-155). It writes `VALIDATION.md` flagging:

- File references in the SKILL.md that don't resolve
- CLI commands the skill cites that aren't registered in `bin/gad.cjs`
- Shape mismatches against the dot-agent format

Proto-skills with open validation flags can still be promoted if the human reviewer
decides the flags are acceptable.

## Life cycle commands

```sh
gad evolution status                       # count candidates + proto-skills by stage
gad evolution validate <slug>              # write VALIDATION.md for one proto-skill
gad evolution promote <slug> [--name X]    # move proto-skill → skills/, keep PROVENANCE.md
gad evolution discard <slug> [--keepCandidate]
```

Promote is the only operation that moves a proto-skill's SKILL.md. PROVENANCE.md
travels with it. Discard deletes the proto-skill dir; if `--keepCandidate` is passed,
the originating candidate stays in the queue to be re-drafted later.

## Relationship to `gad-skill-creator`

| | `create-proto-skill` | `gad-skill-creator` |
|---|---|---|
| Input | candidate handoff on filesystem | human conversation |
| Stakes | advisory, bulk | high, human-in-the-loop |
| Output location | `skills/proto-skills/` | `skills/` directly |
| Provenance | carries PROVENANCE.md forever | optional |
| Batching | yes | no |

Both end up in `skills/` eventually. The difference is the path by which they
got there, and that path stays recorded.

