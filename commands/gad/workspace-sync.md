---
name: gad:workspace-sync
description: Crawl monorepo for .planning/ directories and sync planning-config.toml roots
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<objective>
Discover all `.planning/` directories in the repository and sync `[[planning.roots]]` entries
in `planning-config.toml`. Entries already present are preserved. New entries are added.
Removed directories prompt before deletion.
</objective>

<process>

1. **Load current config:**
   ```bash
   node "vendor/get-anything-done/get-shit-done/bin/gsd-tools.cjs" config-get planning.roots 2>/dev/null || echo "[]"
   ```
   Also read `planning-config.toml` directly to get existing roots.

2. **Crawl for .planning/ directories:**
   Find all `.planning/` directories from the repo root, excluding paths in `planning.ignore`:
   ```bash
   find . -name ".planning" -type d \
     | grep -v node_modules | grep -v dist | grep -v .git \
     | sort
   ```

3. **Compute diff:**
   - For each discovered path not in `[[planning.roots]]`: show as **NEW**
   - For each `[[planning.roots]]` path whose `.planning/` no longer exists: show as **REMOVED**
   - For each `[[planning.roots]]` path still present: show as **OK**

4. **Display summary:**
   ```
   Workspace sync — found N .planning/ directories

   ✓ OK     [global]   ./.planning
   + NEW    [?]        vendor/grime-time-site/.planning
   ! REMOVED [old-sub]  vendor/deprecated/.planning  (dir missing)
   ```
   Auto-generate an `id` for new entries from the parent directory name.

5. **Ask to apply** (if any changes):
   ```
   Apply changes to planning-config.toml? (y/n)
   ```

6. **Write updated `[[planning.roots]]`** to `planning-config.toml` (or `.planning/planning-config.toml`
   following the file's current location).
   - Add new entries with `discover = false`
   - Remove confirmed-removed entries
   - Preserve all other config unchanged

7. **Confirm:**
   ```
   ✓ planning-config.toml updated — N roots registered
   ```

</process>

<rules>
- Never delete existing roots without explicit user confirmation
- Preserve entry order: existing roots first, new roots appended
- Auto-generated id = dirname of the entry's parent path (e.g., `vendor/my-proj` → `my-proj`)
- If planning-config.toml doesn't exist, create it from the template at
  `vendor/get-anything-done/get-shit-done/templates/planning-config.toml`
</rules>
