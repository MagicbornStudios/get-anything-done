# Phase Context Template

This is a reusable planning pattern, not a GAD-runtime-specific file format. Keep the structure,
but adapt filenames and schema details to the planning format the project actually uses.

Template for `.planning/phases/XX-name/{phase_num}-CONTEXT.md` when a project keeps per-phase
context files.

**Purpose:** Document decisions that downstream agents need. The researcher uses this to know what
to investigate. The planner uses this to know what choices are locked versus flexible.

**Key principle:** Categories are not predefined. They should emerge from what was actually
discussed for this phase. A CLI phase has CLI-relevant sections. A UI phase has UI-relevant
sections.

**Downstream consumers:**
- `gad-phase-researcher` reads decisions to focus research.
- `gad-planner` reads decisions to create concrete executable tasks.

---

## File Template

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers - the scope anchor. This comes from the roadmap and is fixed. Discussion clarifies implementation within this boundary.]

</domain>

<decisions>
## Implementation Decisions

### [Area 1 that was discussed]
- **D-01:** [Specific decision made]
- **D-02:** [Another decision if applicable]

### [Area 2 that was discussed]
- **D-03:** [Specific decision made]

### Claude's Discretion
[Areas where the user explicitly said "you decide" - the implementing agent has flexibility here during planning and execution.]

</decisions>

<specifics>
## Specific Ideas

[Product references, examples, "I want it like X" moments, or exact behaviors.]

[If none: "No specific requirements - open to standard approaches"]

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents must read these before planning or implementing.**

[List every spec, ADR, feature doc, or design doc that defines requirements or constraints for this phase. Use full relative paths.]

### [Topic area 1]
- `path/to/spec-or-adr.md` - [What this doc decides or defines]
- `path/to/doc.md` §N - [Specific section and what it covers]

[If the project has no external specs: "No external specs - requirements are fully captured in decisions above"]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [Component/hook/utility]: [How it could be used in this phase]

### Established Patterns
- [Pattern]: [How it constrains or enables this phase]

### Integration Points
- [Where new code connects to the existing system]

</code_context>

<deferred>
## Deferred Ideas

[Ideas that came up during discussion but belong in other phases.]

[If none: "None - discussion stayed within phase scope"]

</deferred>
```

---

## Guidance

This template captures decisions for downstream agents.

Good content:
- "Card-based layout, not timeline"
- "Retry 3 times on network failure, then fail"
- "Group by year, then by month"
- "JSON for programmatic use, table for humans"

Bad content:
- "Should feel modern and clean"
- "Good user experience"
- "Fast and responsive"
- "Easy to use"

After creation:
- The file should live with the project's phase artifacts.
- `gad-phase-researcher` should be able to focus investigation from it.
- `gad-planner` should be able to turn it into concrete work without re-asking the user.

**Critical - canonical references:**
- The `<canonical_refs>` section is mandatory.
- If the project has external specs, ADRs, or design docs, list them with full relative paths.
- If the roadmap already names canonical refs for the phase, expand them here.
- Inline mentions like "see ADR-019" are not enough. Downstream agents need full paths.
- If no external specs exist, say so explicitly.
