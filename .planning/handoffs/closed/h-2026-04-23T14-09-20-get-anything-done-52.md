---
id: h-2026-04-23T14-09-20-get-anything-done-52
projectid: get-anything-done
phase: 52
task_id: 52-05
created_at: 2026-04-23T14:09:20.105Z
created_by: unknown
claimed_by: team-w1
claimed_at: 2026-04-23T14:09:20.341Z
completed_at: 2026-04-23T14:14:38.878Z
priority: normal
estimated_context: mechanical
runtime_preference: codex-cli
---
# 52-05 — VirtualFileFolder adapter unit tests

**Goal:** vitest unit tests for the VirtualFileFolder primitive's adapter contract + expand/collapse state. Final task blocking phase 52 close.

**Location:** packages/editor-core/src/VirtualFileFolder/ (or wherever the primitive lives — grep `rg -n "VirtualFileFolder" packages/editor-core`). Tests co-located or in `packages/editor-core/tests/`.

**What to cover:**
1. Adapter contract: implementations must provide list/read/readBytes APIs; test with a fake in-memory adapter that the primitive invokes correctly.
2. Expand/collapse state: toggling a node updates state; collapsed child state persists through re-renders; lazy-load on expand only fires once.
3. Error paths: adapter returns null/throws → component renders empty/error state cleanly.
4. Adapter swap: same component state survives adapter swap at runtime (local FS → Supabase adapter migration path per decision gad-254).

**Convention:** match packages/editor-core existing test setup (`pnpm --filter @portfolio/editor-core test`).

**Acceptance:** `pnpm --filter @portfolio/editor-core test` green. Coverage >80% on VirtualFileFolder component + types.

**Verification constraint:** use `node vendor/get-anything-done/bin/gad.cjs` for CLI. Pre-commit hook retired.

**Stamp** 52-05 done with codex attribution. After this task lands, phase 52 is closeable (all 6 tasks done).