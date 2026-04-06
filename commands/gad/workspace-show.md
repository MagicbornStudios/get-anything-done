---
name: gad:workspace-show
description: Show all registered planning roots and their current status
allowed-tools:
  - Read
  - Bash
---

<objective>
Display all `[[planning.roots]]` entries from `planning-config.toml` with their
current state (phase, milestone progress, last modified).
</objective>

<process>

1. **Load config:**
   ```bash
   node "vendor/get-anything-done/bin/gad-tools.cjs" config-get planning 2>/dev/null
   ```

2. **For each root**, read its STATE.md and ROADMAP.md:
   ```bash
   cat "<root.path>/<root.planningDir>/STATE.md" 2>/dev/null | head -30
   ```

3. **Display table:**
   ```
   GAD Workspaces — 3 roots registered

   ID            PATH                      PHASE      MILESTONE
   ──────────────────────────────────────────────────────────────
   global        .                         3 / 8      M2
   grime-time    vendor/grime-time-site    1 / 4      M1
   get-anything-done  vendor/get-anything-done  —    —
   ```

4. Show `docs_sink` if configured:
   ```
   Docs sink: apps/portfolio/content/docs/planning
   ```

</process>
