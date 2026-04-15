# Subagent discovery test battery — findings

**Date:** 2026-04-15
**Phase:** 42.2 evolution turn
**Prompted by:** operator — "test with subagents to make sure they have awareness of
skills when they first load up. do a basic example of a task, spin up many agents giving
them many different tasks and ask them what skills they would use and how they got the
info. ask them how what order of skills they would use to do the evolution workflow, and
how to handle skill placement and creation in general. dont tell them how. they should
only reference skills during these tests. we are testing how confusing the workflows are
for skills and if the expected workflows would be completed based on the knowledge
present in the skills alone, the only tool they can use is the gad cli and the commands
it provides to find any information."

## Protocol

Five parallel cold subagents spawned, each given one distinct task plus identical
tool restrictions:

- **Bash** allowed ONLY for `node bin/gad.cjs <subcommand>` invocations
- **Read** allowed ONLY on paths surfaced by prior gad CLI output
- **No Glob, Grep, or arbitrary file reads**
- No reading CLAUDE.md / AGENTS.md / anything they weren't pointed to by the CLI

Each agent reported a structured JSON result with: CLI commands run (in order),
skills discovered with provenance, workflow read-chain (depth ≤3 hops), proposed
skill order for the task, confidence score, and explicit gaps.

## Results summary

| Agent | Task | Skills found (correct) | Confidence | Primary blocker |
|---|---|---|---|---|
| A | Plan a phase | gad-plan-phase + 5 siblings (no bodies read) | **5/10** | Could not read any SKILL.md body — no CLI verb surfaces skill file paths |
| B | Run an evolution cycle | gad-evolution-evolve → create-proto-skill → gad-evolution-validator | **8/10** | Path duality (`workflows/evolution-evolve.md` vs `.planning/workflows/gad-evolution.md`); validator workflow not read |
| C | Debug a failing test | gad-debug | **7/10** | Same path duality; `gad skill list` prints names only |
| D1 | Session startup | (no skill — `gad snapshot` CLI is the contract) | **9/10** | Chicken-and-egg: `gad snapshot` only discoverable via CLAUDE.md or by reading decision gad-18 from INSIDE the snapshot output |
| D2 | Create a new skill | create-skill + create-proto-skill + gad-skill-creator + merge-skill + references/skill-shape.md §10 | **7/10** | EQUIPPED SKILLS top-5 excluded ALL four authoring skills; three overlapping authoring skills, no CLI disambiguation |
| E | Candidate → canonical | gad evolution status → create-proto-skill → validate → install → promote | **8/10** | Stale docs (skills/candidates/ refs); task 42.2-13 blocked on 42.2-06; promote split-bundle gap |

Mean confidence: **7.3 / 10**. Agent A (5/10) is the most damning — a strict cold
agent cannot legally read any skill body under current CLI affordances.

## Read-chain flow map (authored from agent reports)

Every file an agent READS is a node. Every reference an agent FOLLOWS is an edge.
The entry point (depth 0) is the first file read. Depth caps at 3 hops.

```
DEPTH 0 (entry points — reached directly from CLI output)
├── gad snapshot STATE.xml <references>
│   ├── .planning/workflows/gad-debug.md                    (C)
│   ├── .planning/workflows/gad-discuss-plan-execute.md     (A)
│   ├── .planning/workflows/README.md                       (A)
│   ├── references/skill-shape.md                           (D2)
│   ├── references/proto-skills.md                          (E)
│   └── skills/gad-evolution-evolve/SKILL.md                (B — also via gad context)
│
├── gad skill list
│   └── (prints names only — no file paths → agents cannot Read) (A blocked here)
│
└── gad evolution status
    └── .planning/candidates/<slug>/CANDIDATE.md            (E — name + path both)

DEPTH 1 (reached by following a reference in a depth-0 file)
├── skills/gad-debug/SKILL.md          ← referenced by .planning/workflows/gad-debug.md (C)
├── workflows/evolution-evolve.md      ← workflow: frontmatter pointer from SKILL.md (B)
└── (A: no depth-1 hop possible — depth-0 files didn't contain skill file path literals)

DEPTH 2 (reached by following a reference in a depth-1 file)
├── skills/create-proto-skill/SKILL.md         ← referenced by workflows/evolution-evolve.md (B)
├── skills/gad-evolution-validator/SKILL.md    ← referenced by workflows/evolution-evolve.md (B)
└── (C stopped at depth 1 with enough info)

NEVER REACHED (but would have been needed for 10/10 confidence):
× workflows/evolution-validator.md     (B — validator mechanics unverified)
× workflows/gad-plan-phase.md           (A — could not reach at all, path never surfaced)
× skills/gad-plan-phase/SKILL.md       (A — same reason)
× references/skill-shape.md            (B — uniform bundle shape unverified)
× site/scripts/compute-self-eval.mjs   (B — pressure formula unverified)
```

**Edge count by entry-point type:**
- `gad snapshot` STATE.xml references: **6 entry points** (the dominant discovery vehicle)
- `gad skill list`: **0 entry points** (names only, no paths — dead end for Read)
- `gad skill list --paths`: **0 entry points** (didn't exist at test time — now fixed, task 42.2-20)
- `gad skill show <id>`: **0 entry points** (didn't exist at test time — now fixed, task 42.2-20)
- `gad evolution status`: **1 entry point** (candidate path)

## P0 gaps (fix immediately)

1. **No `gad skill show <id>`.** Agent A (5/10) couldn't reach
   `skills/gad-plan-phase/SKILL.md` under strict CLI-only rules. ✅ **FIXED
   in task 42.2-20** — `gad skill show <id>` and `gad skill list --paths`
   shipped in commit `ce53f94`.

2. **Path duality: `workflows/` vs `.planning/workflows/`.** Agents B and C both
   hit this. They couldn't tell whether the two directories hold duplicate
   copies, superseded versions, or different artifacts. ✅ **CLARIFIED in task
   42.2-20** — `references/skill-shape.md §1a` now documents the distinction
   with a side-by-side table and the "right CLI verb for the right tree" rule.

3. **Stale doc: `references/proto-skills.md` still cited `skills/candidates/`.**
   Agent E flagged this. Task 42.2-15 migrated the directory but missed updating
   this doc. ✅ **FIXED in task 42.2-20** — three refs updated to `.planning/candidates/`.

## P1 gaps (fix in a follow-up)

4. **`gad snapshot` EQUIPPED SKILLS top-5 excludes authoring skills.** Agent D2
   noted that a cold agent starting from snapshot output would see the top-5
   by Jaccard relevance — framework-upgrade, portfolio-sync, etc. — and miss
   create-skill/create-proto-skill/gad-skill-creator/merge-skill entirely.
   The authoring skills only surface if sprint tasks contain matching tokens.

   **Proposed fix:** add a "pinned skills" section to the snapshot that always
   shows the authoring skills + session-start skills regardless of relevance
   scoring. Or: boost their relevance score when the snapshot detects an
   authoring-like query.

5. **Chicken-and-egg on session start.** Agent D1 noted that `gad snapshot` is
   only discoverable via CLAUDE.md or by reading decision gad-18 from INSIDE
   the snapshot output itself. A truly cold agent without any startup hint
   would not find it.

   **Proposed fix:** `gad help session` or `gad --startup` command that prints
   the session-start contract in three sentences: "run `gad snapshot --projectid
   <id>` at session start", "read the STATE.xml references block", "follow the
   next-action line". No skill needed — just a one-shot CLI affordance.

6. **Three overlapping authoring skills, no CLI disambiguation.** Agent D2
   reported `create-skill`, `create-proto-skill`, `gad-skill-creator`, and
   `merge-skill` all surface from `gad skill list` with no ordering guidance.
   Disambiguation only becomes clear after reading `references/skill-shape.md`
   §10/§11.

   **Proposed fix:** embed the lifecycle diagram from skill-shape.md §11 into
   the `gad skill list` output footer, with a three-line "which skill when"
   table. Or: `gad skill show create-skill` should print "see also: create-proto-skill
   for evolution-candidate drafts, gad-skill-creator for eval-backed heavy path".

## P2 gaps (architectural, defer)

7. **Participants in workflows reference skills not always findable.** Agent C
   noted `participants.skills: [debug, gad-debug]` in
   `.planning/workflows/gad-debug.md`; the bare `debug` skill is not in
   `gad skill list`. Either it's a planning-doc reference to a non-canonical
   skill, or the participant list is stale. Needs a validator rule.

8. **External dependency unreachable.** Agent B noted `create-proto-skill`
   SKILL.md references `~/.agents/skills/create-skill/SKILL.md` (the dot-agent
   external skill). This is outside the repo sandbox; a cold agent can't
   verify authoring rules. Either inline the contract or note it as optional.

9. **Workflow validator internals unverified.** Agent B (the only agent who
   cared) could not trace down to `workflows/evolution-validator.md` because
   its SKILL.md stub didn't prompt a depth-3 hop. The stub shape of
   evolution-validator's SKILL.md is doing the right thing (thin entry) but
   agents stop there under bounded-depth exploration.

   **Proposed fix:** SKILL.md thin-entry shape should include a single
   prominent line "To see the full process, run `gad skill show <id> --body`"
   that triggers the depth-increment without requiring raw path reading.

## Findings for the DSL exploration

The read-chain map above is exactly the kind of data the flow-control DSL in
`.planning/notes/workflow-flow-control-dsl-exploration-2026-04-15.md` aims to
formalize. Observations relevant to DSL design:

- **Agents exit early when confident enough.** C stopped at depth 1. B stopped
  at depth 2 for most branches. A stopped at depth 0 because it was blocked,
  not satisfied. This suggests the DSL does NOT need to enforce "read the
  whole chain" — it should let agents declare "I have enough" and measure
  that declaration against actual task completion.
- **Agents follow `workflow:` frontmatter pointers 100% of the time when
  present.** This is strong signal that the pointer is the single most
  valuable affordance in the canonical skill shape.
- **Depth >2 is rare.** Across five tasks, only one read (B → validator
  workflow) would have required depth 3, and the agent chose to skip it.
  The DSL should assume most useful traversal fits in 2 hops.
- **Participant lists (`participants.skills`) are NOT used as read targets.**
  Agents read them as "confirmation that a skill exists", not as "go read
  these files". If the DSL wants to drive traversal through participants,
  it needs to emit follow-links that agents recognize.

## Testing cadence proposal

The subagent discovery battery should be **rerun after any substantial
change to the skill catalog or CLI discovery surface**. Treat it as a
regression test for documentation coherence, not just for code correctness.
Specifically rerun:

- After adding or removing a canonical skill (including proto-skill promotion)
- After renaming a workflow file or changing a `workflow:` frontmatter pointer
- After changing `gad skill list` / `gad skill show` / `gad snapshot` output format
- After promoting or demoting a skill between canonical and proto tiers
- After any changes to `references/skill-shape.md` or `references/proto-skills.md`

Each rerun produces a new findings file at
`.planning/notes/subagent-discovery-findings-<date>.md`. Confidence scores
can be tracked over time as a regression metric: a drop in mean confidence
is a signal that discovery coherence regressed.

## Aggregate CLI command frequency

Across 40+ CLI calls from 5 agents, the most-used commands were:

| Command | Usage count | Purpose |
|---|---|---|
| `gad --help` | 5/5 agents | Top-level surface |
| `gad skill list` | 5/5 agents | Primary skill inventory |
| `gad snapshot --projectid <id>` | 5/5 agents | Full context + STATE references |
| `gad skill --help` | 4/5 agents | Skill subcommand surface |
| `gad evolution --help` | 2/5 agents | Evolution subcommand surface |
| `gad evolution status` | 2/5 agents | Live evolution state + candidate path |
| `gad context --help` | 2/5 agents | Context subcommand (agent A, B) |

Commands not used by any agent: `gad tasks`, `gad decisions`, `gad phases`,
`gad docs`, `gad refs`, `gad rounds`, `gad workflow promote`, `gad skill promote`.
Worth investigating whether `gad tasks` / `gad decisions` deserve more prominence
in the top-5 snapshot or whether they're inherently lower-priority for cold agents.

## Final verdict

The current skill catalog is **mostly discoverable** (mean 7.3 confidence) but
has four concrete gaps, two of which were fixable in one CLI change (`gad skill
show` + `--paths`) and are already shipped in task 42.2-20. The remaining two
(EQUIPPED SKILLS bias toward high-relevance-only, chicken-and-egg session
start) are P1 and should be scheduled as follow-up tasks. The path-duality
confusion (addressed in task 42.2-20 skill-shape.md §1a) was docs-only.

Rerun the battery after the P1 fixes land. Target: mean confidence ≥ 8.5
with no single agent below 7.
