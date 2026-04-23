---
id: h-2026-04-23T14-09-51-get-anything-done-47
projectid: get-anything-done
phase: 47
task_id: 47-01
created_at: 2026-04-23T14:09:51.887Z
created_by: unknown
claimed_by: team-w1
claimed_at: 2026-04-23T15:22:08.772Z
completed_at: null
priority: normal
estimated_context: reasoning
runtime_preference: codex-cli
---
# 47-01 — TweakCN-OpenAI extraction audit (TweakCN kickoff)

**Operator context 2026-04-23:** B2Gdevs/TweakCN-OpenAI is operator's own fork. Integration re-targeted from original GAD landing site to **apps/desktop Settings**. Users customize shadcn theme + copy-paste the export to take it elsewhere (TweakCN native behavior).

**This is the PLANNING task for the whole TweakCN integration.** Don't execute 47-02..04 or 48/49 work yet — just produce the audit + plan.

## Scope

1. **Inspect source:** B2Gdevs/TweakCN-OpenAI repo — operator's fork. Reference clone at `vendor/get-anything-done/tmp/tweakcn/` may be stale; check `git log` inside to see how recent. If stale, clone fresh to `vendor/get-anything-done/tmp/tweakcn-fresh/` or similar.

2. **Identify extraction boundaries:**
   - Theme engine (CSS-variable serializer, token resolver)
   - Zustand stores (theme state, undo stack if present)
   - Editor UI components (color pickers, sliders, preset browser, export panel)
   - OpenAI integration (theme-from-prompt generator)
   - Route/app shell (what to drop — we don't want Next.js app scaffolding)

3. **Map deps:** peer deps to declare vs internal deps to bundle. React 19 + @ai-sdk/react + zustand are peer. Anything Next-specific (router, server actions) must be replaced with framework-agnostic equivalents.

4. **Copy-paste export flow:** TweakCN has a native "Export" or "Copy" panel that emits theme JSON/CSS. Confirm it exists, identify the component(s), and ensure extraction preserves it intact — this is a hard operator requirement.

5. **Propose package shape:** suggested exports for `packages/tweakcn-openai/` (mountable editor component, theme provider, hook). Entry point shape.

## Deliverable

Write `.planning/notes/2026-04-23-tweakcn-extraction-audit.md` with:
- Source summary (repo URL, commit SHA audited, LOC by area)
- Extraction map: file-by-file what moves, what's dropped, what needs rewrite
- Dep graph: peer deps + internal deps
- Copy-paste export flow documented with component paths
- Proposed package shape (exports)
- Risks + open questions

**Do NOT write code or create packages/tweakcn-openai yet.** This is the audit/plan step. 47-02 consumes this plan.

**Verification constraint:** use `node vendor/get-anything-done/bin/gad.cjs`. Pre-commit hook retired.

**Stamp** 47-01 done with codex attribution. 47-02 picks up next.