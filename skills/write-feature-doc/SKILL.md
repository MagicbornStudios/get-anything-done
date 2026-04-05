---
name: gad:write-feature-doc
description: Produce a feature documentation MDX file into the docs sink. Use when a project feature needs clear human-readable documentation.
---

# gad:write-feature-doc

Writes a feature doc into the right place in the sink and registers it in the project's DOCS-MAP.xml.

## When to use

- A feature exists but has no documentation
- User asks for a doc on a specific feature or capability
- A docs.project (dialogue-forge, books, etc.) needs feature coverage

## Steps

1. **Identify project and feature**
   ```sh
   gad ls                              # find project id
   gad refs --projectid <id>           # see what docs already exist
   ```

2. **Read context**
   ```sh
   gad state --projectid <id>
   gad decisions --projectid <id>
   ```

3. **Write the doc**
   - Path: `{docs_sink}/{project}/{feature-name}.mdx`
   - No `generated: true` — this is human-quality, human-editable
   - Use standard MDX frontmatter: `title`, `description`, `date`
   - Structure: overview → why it exists → how it works → usage → examples

4. **Register in DOCS-MAP.xml**
   Add an entry to `.planning/DOCS-MAP.xml`:
   ```xml
   <doc kind="feature" sink="{project}/{feature-name}.mdx" skill="gad:write-feature-doc">
     <description>What this doc covers</description>
   </doc>
   ```

5. **Sync**
   ```sh
   gad sink sync
   ```

## Notes

- Feature docs are never overwritten by `gad sink compile` — no `generated: true`
- They persist across syncs
- Link to planning docs where relevant (`gad decisions`, `gad refs`)
