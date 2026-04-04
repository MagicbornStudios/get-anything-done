---
name: gad:docs-compile
description: Compile planning docs from all roots into docs_sink as MDX files
argument-hint: [--sink <path>]
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<objective>
Read `STATE.md` and `ROADMAP.md` from every registered `[[planning.roots]]` entry
and write MDX equivalents to the configured `docs_sink`. The sink is NEVER the
source — source files in `.planning/` are never modified.
</objective>

<process>

1. **Load config:**
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get planning 2>/dev/null
   ```
   Also parse `--sink <path>` from `$ARGUMENTS` to override `docs_sink`.

2. **Validate sink:**
   - If `docs_sink` is not configured and `--sink` not provided, show error:
     ```
     No docs_sink configured. Set docs_sink in planning-config.toml or pass --sink <path>.
     ```

3. **For each root:**
   a. Read `<root.path>/<root.planningDir>/STATE.md`
   b. Read `<root.path>/<root.planningDir>/ROADMAP.md`
   c. Write to `<sink>/<root.id>/STATE.mdx` and `<sink>/<root.id>/ROADMAP.mdx`

   **MDX transformation:**
   - Add frontmatter header:
     ```mdx
     ---
     title: <root.id> — Planning State
     description: Auto-compiled from <root.path>/<root.planningDir>/STATE.md
     generated: <ISO date>
     source: <root.path>/<root.planningDir>/STATE.md
     ---
     ```
   - Preserve all Markdown content verbatim below the frontmatter
   - Replace relative links `./phases/` → `<sink>/<root.id>/phases/`

4. **Copy phase subdirs** (if they exist):
   For each `<root.planningDir>/phases/` directory, compile each phase's
   `PLAN.md`, `SUMMARY.md`, `KICKOFF.md` → `.mdx` equivalents in
   `<sink>/<root.id>/phases/<phase>/`.

5. **Summary:**
   ```
   ✓ Compiled 3 roots → apps/portfolio/content/docs/planning/
     global    → STATE.mdx, ROADMAP.mdx, 8 phase files
     grime-time → STATE.mdx, ROADMAP.mdx, 4 phase files
     gad       → STATE.mdx, ROADMAP.mdx (no phases yet)
   ```

</process>

<rules>
- Never modify source `.planning/` files
- Overwrite existing sink files (sink is always rebuilt from source)
- Create sink directories as needed with `mkdir -p`
- Skip roots where STATE.md or ROADMAP.md don't exist; log a warning
</rules>
