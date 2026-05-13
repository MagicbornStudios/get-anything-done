---
id: h-2026-05-13T15-02-01-get-anything-done-75
projectid: get-anything-done
phase: 75
task_id: null
created_at: 2026-05-13T15:02:01.559Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: normal
estimated_context: prescribed
risk: safe
time: standard
surface: local
runtime_preference: claude-code
---
Phase 184-20 framework lane: wire gad env --web CLI subcommand. SPA artifact at packages/gad-surface/dist/web/. Serve static + GET /api/env returning EnvSnapshot JSON. See 184-PLAN.md task 184-20.
## Auto-closed 2026-05-13

Closed by main-session audit — the premise was wrong. `gad env --web` was already intentionally deprecated in phase 196-03 via decision GLOBAL-D-338. The localhost-server pattern was removed by design; reinstating it would conflict with that decision. The Env surface lives in apps/desk's native Env panel instead. The packages/gad-surface SPA build (from phase 184 task 184-20) can be previewed via simple static serve when a cross-surface preview is wanted, but does not need to be wired into the deprecated gad env --web command.
