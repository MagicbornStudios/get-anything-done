---
name: gad:write-feature-doc
description: Produce a feature documentation MDX file into the docs sink. Use when a project feature needs clear human-readable documentation that persists across sessions.
---

# gad:write-feature-doc

Writes a feature doc into the docs sink and registers it in the project's DOCS-MAP.xml.

## When to use

- A feature exists but has no documentation
- User asks for a doc on a specific feature or capability
- After shipping a feature, to create the reference page
- A docs.project needs feature coverage

## Step 1 — Identify project and feature

```sh
gad ls                              # find project id
gad docs list --projectid <id>      # see what docs already exist
gad refs --projectid <id>           # see file references
```

Don't duplicate — if a doc already covers this feature, update it instead.

## Step 2 — Read context

```sh
gad decisions --projectid <id>      # relevant architectural decisions
gad state --projectid <id>          # current project state
```

Understand why the feature exists and what decisions shaped it. Reference decision IDs in the doc.

## Step 3 — Write the doc

**Path:** `apps/portfolio/content/docs/{project-id}/{feature-name}.mdx`

**Frontmatter:**
```yaml
---
title: Feature Name
description: One-line description for metadata/search
---
```

**Do NOT add `generated: true`** — feature docs are human-quality, human-editable. They persist across `gad sink compile` runs.

**Structure:**
1. **Overview** — what this feature does in 2-3 sentences
2. **Why it exists** — the problem it solves, reference decision IDs (e.g. "See gad-09")
3. **How it works** — mechanics, data flow, key interfaces
4. **Usage** — how to use it (commands, API, UI)
5. **Examples** — concrete examples with code blocks or screenshots

Keep it scannable. Use tables for reference data, code blocks for commands, mermaid for diagrams only when they clarify.

## Step 4 — Register in DOCS-MAP.xml

Add to the project's `.planning/DOCS-MAP.xml`:

```xml
<doc kind="feature" sink="{project-id}/{feature-name}.mdx" skill="gad:write-feature-doc">
  <description>What this doc covers — one line</description>
</doc>
```

If DOCS-MAP.xml doesn't exist yet, create it:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<docs-map>
  <doc kind="feature" sink="..." skill="gad:write-feature-doc">
    <description>...</description>
  </doc>
</docs-map>
```

## Step 5 — Sync and verify

```sh
gad sink sync                                    # compile planning docs
gad docs list --projectid <id>                   # verify doc appears
```

## What makes a good feature doc

| Quality | Check |
|---------|-------|
| Standalone | A new agent can understand the feature without reading chat history |
| Decision-linked | References decision IDs for the "why" — not just the "what" |
| Current | Matches the actual implementation, not a stale plan |
| Scannable | Someone skimming gets the gist in 30 seconds |
| Not a tutorial | Explains what exists, not how to build it from scratch |

## What to avoid

- Implementation diary ("we tried X, then Y, then settled on Z") — that's ERRORS-AND-ATTEMPTS.xml
- Commit log prose ("added support for...", "now surfaced...") — describe the feature, not the history
- Duplicating planning docs — don't restate the roadmap or task registry
