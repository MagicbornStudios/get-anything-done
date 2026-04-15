---
name: gad:migrate-schema
description: Convert RP XML planning files (STATE.xml, ROADMAP.xml) to GAD Markdown format
argument-hint: [--path <planning-dir>]
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
workflow: workflows/migrate-schema.md
---

<objective>
Detect and convert repo-planner XML planning files (`STATE.xml`, `ROADMAP.xml`,
`TASK-REGISTRY.xml`, `REQUIREMENTS.xml`) to GAD Markdown equivalents. Original XML
files are archived to `<planningDir>/archive/xml/` — never deleted.
</objective>

<process>

Parse `--path <dir>` from `$ARGUMENTS` (default: `.planning/`).

1. **Detect XML files:**
   ```bash
   ls "$PLANNING_DIR"/*.xml 2>/dev/null
   ```
   If none found, report: `No XML files found in <path> — nothing to migrate.`

2. **Show migration plan:**
   ```
   Migration plan for .planning/

   STATE.xml        → STATE.md
   ROADMAP.xml      → ROADMAP.md
   TASK-REGISTRY.xml → (merged into STATE.md performance metrics)
   REQUIREMENTS.xml  → REQUIREMENTS.md

   Archive: .planning/archive/xml/
   ```
   Confirm before proceeding.

3. **Migrate STATE.xml → STATE.md:**
   Read the XML, extract key fields:
   - `<current-phase>` → `## Current Position`
   - `<milestone>` → milestone header
   - `<completed-phases>` → completed phase list
   - `<active-issues>` → open issues section
   - `<performance-metrics>` → metrics table

   Write `STATE.md` following the GAD state template format.

4. **Migrate ROADMAP.xml → ROADMAP.md:**
   Read `<phase id>`, `<title>`, `<status>`, `<description>` elements.
   Write `ROADMAP.md` as a Markdown checklist:
   ```markdown
   # Roadmap

   ## Milestone N: <name>

   - [x] **Phase 1: <title>** — <description>
   - [ ] **Phase 2: <title>** — <description>
   ```

5. **Migrate TASK-REGISTRY.xml → STATE.md metrics section:**
   Merge task rows into the `## Performance Metrics` section of STATE.md.

6. **Migrate REQUIREMENTS.xml → REQUIREMENTS.md:**
   Convert requirement nodes to Markdown sections.

7. **Archive originals:**
   ```bash
   mkdir -p "$PLANNING_DIR/archive/xml"
   mv "$PLANNING_DIR"/*.xml "$PLANNING_DIR/archive/xml/"
   ```

8. **Summary:**
   ```
   ✓ Migration complete — .planning/

   Created:  STATE.md, ROADMAP.md, REQUIREMENTS.md
   Archived: STATE.xml, ROADMAP.xml, TASK-REGISTRY.xml, REQUIREMENTS.xml
             → .planning/archive/xml/

   Review the migrated files before committing.
   ```

</process>

<rules>
- Never delete XML files — always archive
- If a target .md file already exists, create <name>-migrated.md instead and warn
- Log every field that couldn't be mapped so nothing is silently lost
- Validate that ROADMAP.md has the same number of phases as ROADMAP.xml
</rules>
