---
name: gad:write-tech-doc
description: Produce a technical breakdown doc — architecture, data flow, component design. Use when a system needs to be explained structurally.
---

# gad:write-tech-doc

Writes a technical documentation MDX file into the sink covering architecture, data flow, or system design.

## When to use

- A system exists but its design hasn't been written down
- Onboarding a new agent or developer to a subsystem
- After a significant architectural decision (reference gad:write-intent for the why, this for the how)

## Steps

1. **Identify what to document**
   ```sh
   gad decisions --projectid <id>   # find relevant decisions
   gad refs --projectid <id>        # see existing docs
   ```

2. **Write the doc**
   - Path: `{docs_sink}/{project}/architecture.mdx` or `{project}/{system}-design.mdx`
   - Cover: overview, components, data flow, key interfaces, constraints
   - Use mermaid diagrams where they clarify (```mermaid blocks render in MDX)
   - Reference decisions by ID: "See gad-09 for why context inlines by default"

3. **Register in DOCS-MAP.xml**
   ```xml
   <doc kind="technical" sink="{project}/{name}.mdx" skill="gad:write-tech-doc">
     <description>What system this documents</description>
   </doc>
   ```

4. **Sync**
   ```sh
   gad sink sync
   ```

## Conventions

- Technical docs are human-editable — no `generated: true`
- Link to DECISIONS.xml entries by id for the "why"
- Keep diagrams in the doc, not separate files
- Update when the system changes — stale tech docs are worse than none
