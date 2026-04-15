---
name: gad:workspace-add
description: Add a path as a planning root in gad-config.toml
argument-hint: <path> [--id <id>]
allowed-tools:
  - Read
  - Write
  - Bash
workflow: workflows/workspace-add.md
---

<objective>
Add a new `[[planning.roots]]` entry to `gad-config.toml` for the given path.
Creates `<path>/.planning/` if it doesn't exist.
</objective>

<process>

Parse `$ARGUMENTS`:
- First positional arg = path to add
- `--id <name>` = optional explicit id (defaults to dirname of path)

1. **Validate path exists:**
   ```bash
   ls "$PATH_ARG" 2>/dev/null || echo "PATH_NOT_FOUND"
   ```
   If the path doesn't exist, offer to create it.

2. **Check for duplicate:**
   Read `gad-config.toml` and verify the path isn't already registered.
   If already present, show the existing entry and exit.

3. **Ensure `.planning/` exists:**
   ```bash
   mkdir -p "$PATH_ARG/.planning"
   ```

4. **Append `[[planning.roots]]` entry** to `gad-config.toml`:
   ```toml
   [[planning.roots]]
   id = "<id>"
   path = "<path>"
   planningDir = ".planning"
   discover = false
   ```

5. **Confirm:**
   ```
   ✓ Added [<id>] → <path>/.planning/
   ```

</process>
