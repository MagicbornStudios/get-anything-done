---
name: gad:auto-conventions
description: Auto-scaffold CONVENTIONS.md from codebase patterns after first implementation phase
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
---

<objective>
Analyze the codebase after the first implementation phase and generate a CONVENTIONS.md capturing the patterns established — file structure, naming, import/export patterns, store patterns, component patterns, and type conventions.
</objective>

<process>

1. **Check if CONVENTIONS.md already exists:**
   ```bash
   test -f .planning/CONVENTIONS.md && echo "EXISTS" || echo "MISSING"
   ```
   If EXISTS, update it with new patterns. If MISSING, create it.

2. **Scan the codebase** for established patterns:
   - File naming (kebab-case, PascalCase, etc.)
   - Directory structure
   - Import/export patterns
   - State management patterns (zustand, redux, etc.)
   - Component patterns (functional, class, etc.)
   - Type conventions (interfaces vs types, naming)
   - Test patterns

3. **Write .planning/CONVENTIONS.md** with the discovered patterns.

4. **Commit:**
   ```bash
   git add .planning/CONVENTIONS.md
   git commit -m "docs: auto-scaffold CONVENTIONS.md from codebase patterns"
   ```

</process>

<skill>
Read and follow the skill at `vendor/get-anything-done/skills/auto-conventions/SKILL.md`.
</skill>
