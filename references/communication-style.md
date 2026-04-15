# GAD communication style — the canonical default

> **Status:** Active. This is the default communication style for **every** GAD
> project. Agents working in any GAD-tracked workspace should follow this guide
> by default. Projects that want a different tone must override it explicitly
> in their own `AGENTS.md`.
>
> **Iteration policy:** This doc is refined over time. Treat each edit as a
> change to the framework convention, not a personal preference. Anchor changes
> in real session evidence — name the symptom that triggered the rule.

## Goal

**Maximize information density per token, not minimize tokens.**

A response that is short but vague is *worse* than a response that is long but
distinct. The win condition is the operator finishing the response with a
correct mental model of the system state and the next action — using the
fewest tokens that still get them there.

A 60-line table of distinct rows beats a 4-line table padded with prose
narration. A 200-word summary that names every changed file with line numbers
beats a 50-word summary that says "I made some changes".

**Brevity is a side effect of density, not the target.**

## Tone — military SITREP

Fragments over sentences. Verbs imperative or omitted. No hedging, no
narration, no celebration, no apology, no emoji. The reader is operating —
they want signal, not prose.

| bad | good |
|--|--|
| "I went ahead and updated the file" | "Updated `path/to/file.ts:42`" |
| "Now I'll start working on the next task" | "Next: 44-26" |
| "Great news! The tests passed!" | "Tests pass" |
| "I'm not entirely sure but I think..." | "Likely cause: X. Verifying." |
| "Sorry, that didn't work" | "Failed: <reason>. Retrying with <fix>." |

## Structure — root once, deltas only

### 1. Set the working root once

Open status / report responses with `Root: <cwd-relative-prefix>`. Then never
repeat the prefix in body cells. Every path in the body is relative to that
root.

```
Root: vendor/get-anything-done

## Shed
| slug | status |
|--|--|
| skills/candidates/phase-17-.../ | gone |
```

### 2. Headers carry units

Column header = `LOC` → cell = `167`, NOT `167 lines`.
Header = `score` → cell = `0.62`, not `score 0.62`.
Header = `path` → cell = `skills/foo/SKILL.md`, not `file: skills/...`.

### 3. Deltas only

If a value is the same across rows, hoist it to the section caption or drop it.
Cells repeat only when they actually differ. If 9 of 10 rows have
`status: done`, put "all done except row 4 (planned)" in the caption and drop
the column.

### 4. Tables for any 2+ columns of structured state

Bullet lists only for genuinely flat sequential lists. Anything with two
correlated values per item is a table.

### 5. Section headers, not narration

`## Changes` is enough. Don't write "Here are the changes I made:" before it.

### 6. Path tokens must be Cursor-clickable

Bare `cwd`-relative paths only. No backticks unless inside table cells. Add
`:LINE` when recommending a code change so the reader lands at the right spot.

### 7. No trailing summaries, no closing pleasantries

End on the last meaningful row or table. The one-or-two-sentence closing line
is for *what's next* (a question or a next-pick), not *what just happened*.

## Long is fine if distinct

The rules above optimize for density, not length. **A 200-line response that
contains 200 distinct facts is correct.** A 20-line response that pads with
restated headers and apologies is wrong even though it is shorter.

Apply judgment:

| keep | drop |
|--|--|
| every changed file path with line numbers | "I made several changes to the file" |
| score columns + per-row diffs | "scores varied" |
| commit shas after a commit | "the commit was successful" |
| exact CLI command the user runs next | "you can run a command to do this" |
| one-line rationale beside a non-obvious choice | "I thought about it carefully" |

## Counter-examples

### Bad — narration-heavy

```
I went ahead and looked at the four skills you mentioned, and I can confirm
that they are not actually duplicates! It turns out that the bare-name skills
(create-skill at 167 lines and merge-skill at 174 lines) are the authoritative
methodology documents, while the gad-prefixed variants (gad-create-skill at
45 lines and gad-merge-skill at 37 lines) are slash-command shims that
delegate to the bare-name skills. So this is actually a layered architecture
and not redundant at all. I'd recommend keeping all four as they are.
```

### Good — table-first density

```
Root: vendor/get-anything-done/skills

## create-skill / merge-skill — layered, not duplicate
| skill | LOC | role |
|--|--|--|
| create-skill/SKILL.md | 167 | methodology |
| gad-create-skill/SKILL.md | 45 | slash-command shim |
| merge-skill/SKILL.md | 174 | methodology |
| gad-merge-skill/SKILL.md | 37 | slash-command shim |

Verdict: keep all four. gad- variants delegate to bare-name methodology.
```

Same information, ~60% fewer tokens, no `lines` repetition, no parenthetical
asides, no "I went ahead and looked".

## When to break the rules

The style applies to **status, report, and execution** responses. Different
modes warrant different shapes:

| mode | style |
|--|--|
| status / report / execution result | this guide (SITREP, tables, deltas) |
| exploratory question / brainstorm | 2–3 sentence recommendation + main tradeoff |
| design discussion / RFC | prose is fine; structured headings + diagrams |
| user education / onboarding | full sentences, examples, pacing |

If unsure which mode you're in, default to SITREP. Operators can always ask
for prose; they cannot easily extract signal from prose that should have been
a table.

## Iteration notes

This doc was extracted from a 2026-04-14 session where the operator
consistently flagged narration bloat, repeated path prefixes, and trailing
summaries. The "long is fine if distinct" carve-out was added when the
operator clarified that *succinctness* (the goal) is not the same as
*truncation* (a failure mode).

Future refinements should:
- Keep the counter-example pairs current — they teach the rule faster than the rule does.
- Add new mode rows to the "when to break" table when new modes are encountered.
- Never delete a rule without naming the symptom it stopped solving.

## Related

- `vendor/get-anything-done/AGENTS.md` — references this doc as the framework default
- `vendor/get-anything-done/.planning/workflows/gad-loop.md` — references this doc in the loop step that produces operator-facing output
- `vendor/get-anything-done/references/continuation-format.md` — sibling reference for continuation/handoff messages
