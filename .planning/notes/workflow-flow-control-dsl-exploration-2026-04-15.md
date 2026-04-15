# Workflow flow-control DSL — exploration

**Status:** exploratory notes (2026-04-15, phase 42.2 evolution turn)
**Prompted by:** operator — "explore if having a pseudo language for flow control would be useful for our workflows"

## Why this question surfaced

Workflows under `workflows/` are currently free-form Markdown with loose
conventions: `<objective>`, `<process>`, numbered steps, code fences. Agents
read them top-to-bottom and decide branching on their own. Three concrete
failure modes motivate the DSL question:

1. **Implicit branching.** A workflow step like "if no candidates, exit" is
   plain prose. An agent may or may not notice and may or may not execute
   the exit. Whether it branches correctly is invisible to the workflow
   validator (`gad workflow validate`), because the expected graph carries
   no branch shape.
2. **Implicit loops.** "For each candidate, draft a proto-skill" is a loop.
   If the loop body has state (lock marker → SKILL.md → validator), the
   agent must track per-iteration state. Pure prose doesn't let the workflow
   validator see the loop structure either.
3. **Implicit tool-use expectations.** A step might say "run `gad snapshot`
   and read its output." Whether the workflow EXPECTED this exact CLI call
   shows up only implicitly in the participants frontmatter (`participants.cli:
   [gad snapshot]`). The validator matches tool-use events to participants
   but does not know step order.

A small DSL — not a full Turing-complete language, just enough to make
control flow inspectable — would let the validator diff expected vs actual
execution and let agents follow workflows more reliably.

## Design space

Three positions on the spectrum from "no DSL" to "full programming language":

### Position A: keep free-form Markdown

Current state. Pros: zero adoption cost, humans can write and read fluently,
flexible for research-y / one-shot workflows. Cons: validator can't enforce
branching, agents interpret loops inconsistently, step reordering goes
undetected.

### Position B: structured Markdown annotations

Extend the existing tag convention (`<objective>`, `<process>`) with a small
set of flow-control tags. Lightweight, backwards-compatible, validator can
parse them without a real parser. Example:

```markdown
<workflow>

<step id="1" name="list-candidates" tool="gad evolution status">
  Run `gad evolution status` and parse the "Candidates" section.
  <output var="candidates" type="list"/>
</step>

<branch if="candidates.length == 0">
  <step id="2a" name="exit">
    No candidates to draft. Exit successfully.
  </step>
</branch>

<loop for="candidate in candidates" id="draft-loop">
  <step id="3" name="lock" tool="fs.write">
    Write `.planning/proto-skills/{{candidate.slug}}/PROVENANCE.md` as a lock marker.
  </step>
  <step id="4" name="draft" skill="create-proto-skill">
    Invoke create-proto-skill on CANDIDATE.md.
  </step>
  <step id="5" name="validate" skill="gad-evolution-validator">
    Run validator, write VALIDATION.md.
  </step>
</loop>

<step id="6" name="report">
  Print summary of drafted proto-skills.
</step>

</workflow>
```

Pros: humans still read Markdown, agents get explicit step IDs + branch/loop
structure, validator can emit an **expected graph** from the tags, actual
execution trace matched against it via step IDs. Cons: introduces
convention surface area, requires a lightweight parser, requires updating
existing workflows (retrofit cost). Tags are not programmatically executable
— they're annotations, agents still interpret the prose inside.

### Position C: real executable DSL

A parser + interpreter that actually executes workflow steps. Example shapes
we could borrow: Cue, Dhall, Starlark, a YAML DSL, or a custom domain
language. Pros: workflows become programs, execution is deterministic,
validator becomes a static analyzer. Cons: huge adoption cost, loses the
"agent interprets prose with judgment" advantage, hard to write research-y
workflows, every workflow becomes a code file to maintain. Kills the
methodology-first orientation of GAD.

## Recommendation

**Position B.** Extend the Markdown tag convention with `<workflow>`,
`<step>`, `<branch>`, `<loop>`, and a small set of attributes. The tags are
**advisory annotations** that the workflow validator can parse to build an
expected graph, but agents still read the prose inside the tags and make
judgment calls. This gives us:

1. **Inspectable structure.** `gad workflow validate <slug>` can emit a
   step-by-step expected graph with branch/loop shape. The actual graph
   (from trace events) can be diffed against it. Existing
   `workflow_conformance` metric gains teeth.
2. **No adoption cliff.** Workflows without tags still work as free-form
   Markdown. Tags are opt-in per workflow; the validator skips workflows
   that don't use them.
3. **Agent self-check.** An agent executing a tagged workflow can read
   `<step id="X">` markers and emit `workflow_step_start` / `workflow_step_end`
   trace events with the ID. This makes step-level conformance measurable.
4. **Editable by humans.** The tags are 5-10 new vocabulary items, not a
   syntax to learn. Any Markdown editor handles them.

The DSL pays for itself the moment a workflow has a branch that matters
(evolution loop has several: "no candidates → exit", "validator failed →
retry", "all validated → promote"). Without branch annotations these are
invisible to the validator and trace pipeline.

## Vocabulary proposal (v0)

Seven tags. Seven attributes. That's it.

| Tag | Purpose | Attributes |
|---|---|---|
| `<workflow>` | Root element; one per file | `slug`, `name` (optional, defaults from frontmatter) |
| `<step>` | Leaf execution unit | `id` (required, stable), `name` (optional), `tool` (CLI cmd), `skill` (skill id), `output` (var name for downstream steps) |
| `<branch>` | Conditional block | `if` (JS-style expression over variables) |
| `<else>` | Optional sibling of `<branch>` | (none) |
| `<loop>` | Iteration block | `for` (`item in collection`), `id` (optional) |
| `<parallel>` | Siblings run concurrently | (none) |
| `<output>` | Step-emitted value declaration | `var`, `type` |

Expressions in `if`/`for` are **not evaluated by code** in v0 — they are
parsed but interpreted by the agent. The validator uses them as structural
hints for the expected graph. Future versions could evaluate them against
trace output for exact conformance.

## Interaction with existing workflow infrastructure

- `.planning/workflows/*.md` (meta-loop workflows) stay as free-form prose
  — they describe how the framework operates, not what an agent executes.
- `workflows/*.md` (skill-workflow spec files) are the candidates for
  tagging. Start with 3-5 high-value workflows (evolution-evolve,
  gad-debug, gad-plan-phase) and measure whether tagged versions improve
  conformance metrics.
- `site/scripts/build-site-data.mjs parseWorkflows` already extracts the
  single `mermaid` code block per workflow (decision gad-172). The tag
  parser would run alongside and populate a new `expectedGraph` field on
  each Workflow in `catalog.generated.ts`.
- `detectEmergentWorkflows` (gad-174) stays unchanged — it's about
  DISCOVERING patterns, not enforcing expected shapes.

## Next steps (if the operator approves)

1. Lock the v0 vocabulary in a decision entry (gad-193 or similar).
2. Write a 30-line tag parser in `bin/gad-tools.cjs` or
   `site/scripts/build-site-data.mjs`.
3. Extend `build-site-data.mjs parseWorkflows` to produce `expectedGraph`
   from tag structure when present, fall back to the existing Mermaid
   graph when not.
4. Retrofit ONE high-value workflow (propose: `workflows/evolution-evolve.md`
   since it has the clearest branch/loop shape) and measure conformance.
5. Evaluate whether conformance improved and whether the tag adoption was
   worth the retrofit cost. Greenlight or abandon based on the measurement.

This is a **measured experiment**, not a commit to the design. The
retrofit of one workflow + measurement is the smallest cut that proves
the hypothesis.

## Open questions

- Should tags be **inside** code fences to avoid Markdown collision, or
  **alongside** prose? (Current prose-level `<objective>` convention
  answers this: alongside.)
- Should `<step skill="...">` trigger automatic validator checks that the
  named skill exists? (Yes, trivially — it's a frontmatter pointer
  check.)
- How do nested workflows interact with tag parsing? `parent-workflow`
  in frontmatter already exists; tags would need a `<invoke workflow="..."/>`
  primitive if we want validator to trace cross-workflow execution.
- What is the minimum viable validator behavior that justifies the
  retrofit cost? (Proposed: "step order matches expected graph within ±1
  step reorder, branch shapes match, loops iterate ≥1 time when non-empty
  collection is expected." Below that, the tags are just documentation.)

---

**Bottom line:** a Position B DSL — lightweight tag annotations on top of
Markdown — is worth a one-workflow retrofit experiment. Anything heavier
(Position C) would fight GAD's methodology-first orientation and is not
recommended without much stronger signal that the lightweight version
isn't enough.
