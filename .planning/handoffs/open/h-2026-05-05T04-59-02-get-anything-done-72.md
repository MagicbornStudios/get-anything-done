---
id: h-2026-05-05T04-59-02-get-anything-done-72
projectid: get-anything-done
phase: 72
task_id: null
created_at: 2026-05-05T04:59:02.793Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: high
estimated_context: bounded
risk: safe
time: standard
surface: local
runtime_preference: codex-cli
---
Fix gad install statusline ship pipeline (validated 2026-05-04 by claude-code in monorepo session): hooks/dist/gad-statusline.js was 127 lines stale while hooks/gad-statusline.js was 336 lines live; ran npm run build:hooks to rebuild locally; gad install in slm_learning then picked up the 336-line version successfully. Permanent fix needed: (1) hooks/dist/ is gitignored — clean-clone installs miss the build step. Decide: (a) un-gitignore hooks/dist/ + commit + add build:hooks to precommit/CI, OR (b) bun build --compile pre-step that re-runs build-hooks before binary compile, OR (c) gad install runs build:hooks at install time when local-checkout detected. Pick one and document. (2) Add self-test: gad install should compare embedded vs source hook line counts and warn on drift. (3) After fix lands, rebuild gad binary via build-and-release-locally skill so v1.36+ ships current hooks (the 336-line pressure-aware statusline operator added is the canonical version). Closeout: gad install --force-statusline from a clean clone of any project ships current hook content (no stale dist/). Stamp skill=cli or skill=install. References: vendor/get-anything-done/scripts/build-hooks.js (rebuild script), vendor/get-anything-done/bin/install.js around line 4027 (sdk/hooks/dist preferred, hooks/dist fallback).