---
title: Desktop client + CLI hygiene — phase 52/53/66 plan
date: 2026-04-20
agent: opus-claude
projectid: get-anything-done
phases: [52, 53, 66]
tags: [desktop, tauri, cli-hygiene, installer, cloud-publish]
---

# Today's Plan — 2026-04-20

## Context

Operator wants the Windows desktop client built today. No Codex available
(team command not registered in installed exe), so execution happens with
Claude + Sonnet subagents. Cloud publish backend already shipped under
phase 51 (9 done tasks by cursor-marketplace-lane: Clerk, /my-published,
`gad publish` CLI, marketplace index, operator attribution). Desktop
client wraps our existing apps/planning-app + project-editor + dashboard
in a Tauri shell and shells out to `gad.exe` as a sidecar.

## The CLI mess we hit this morning

Three defects collapsed together at session start:

| Defect | Root cause |
|---|---|
| v1.35.0 SEA build broken | Filesystem-discovery loader (`bin/commands/_loader.cjs`, commit `b94e2298`) needs `bin/commands/*.cjs` at runtime, but SEA pipeline's support-tree extraction drifted. Circular-dep warnings on `provides`/`register`/`postWire` signal that bundled modules load before their exports are set. |
| v1.35.0 Bun build also broken | Bun's static bundler can't see the dynamic `require(path.join(dir, file))` in `_loader.cjs`, so command modules aren't embedded. Result: `error: Cannot find package 'citty' from 'bin/commands/agents.cjs'`. |
| SEA still firing on startup | Installed v1.33.0 exe predates Bun preference; its startup.cjs unconditionally runs `build-release.mjs`. Self-resolves once a working v1.35.0 exe is installed. |

Containment for today: running v1.34.3 Bun exe (from `dist/gad-bun-windows.exe`,
Apr 18, predates the broken loader). Has `phases add` / `tasks add`; does
NOT have `team` (shipped post-1.34.3, but no Codex today so team mailbox
irrelevant).

## Operator directives (2026-04-20)

1. **Remove build-on-startup.** The dogfood-refresh block in
   `bin/commands/startup.cjs` has to go — it's been misfiring and masking
   real defects.
2. **Remove `gad self refresh`.** Same reason. Users want explicit intent,
   not auto-magic.
3. **Plain `gad self build` + `gad self install`.** Separate verbs, single
   purpose each. No SEA fallback.
4. **Pre-commit hook builds+installs IF stale.** Hash src → compare to
   embedded stamp in installed exe → rebuild only if changed. Idempotent.
   This was asked for previously and never landed.
5. **Delete SEA pipeline** (`scripts/build-release.mjs`) — deprecated by
   its own banner, no longer load-bearing once Bun path is healthy.
6. **No shims.** File-lock retry via deferred PS1 is a mask; real fix is
   make install fail loud + actionable if target is locked.

## Windows-only scope

Desktop v1 = Windows x64 only. macOS/Linux explicitly out until operator
reopens. Authenticode cert = HUMAN-TODO when we're ready to ship signed.

## Desktop client shape (phase 53)

- **Host**: Tauri 2.x, Windows x64 target.
- **In-app surfaces** (lifted from existing apps/planning-app):
  - Dashboard (daily entry, handoffs, next-action)
  - Project Editor (from planning-app's `/project-editor`)
  - Bestiary / Brood Editor (from planning-app, once phase 44.5 lands)
  - Marketplace browse (reuses /project-market)
  - Publish wizard (new — fronts the already-existing `gad publish` CLI)
- **Sidecar**: `gad.exe` — Tauri spawns as child process, stdout/stderr
  piped into in-app terminal panel (decision gad-253 terminal-as-chat).
- **Auth**: Clerk per gad-271, solo-operator fallback for local dev.
- **First-run**: detect `claude` CLI → prompt install if missing; detect
  `gad.exe` → download from GH Releases if missing.
- **Editor surface**: `packages/editor-core` (phase 52) — read-only
  CodeView + VirtualFileFolder primitive, pluggable FS/Supabase adapter
  (gad-246, gad-254).

## UI move plan

The operator mentioned UI will need to move. Concrete:

| Current location | Needs to move to | Reason |
|---|---|---|
| `apps/planning-app/app/project-editor/*` | Shared pattern via `packages/editor-core` | Desktop reuses |
| `apps/planning-app/components/VirtualFileFolder` (if exists) | `packages/editor-core` | Shared primitive per gad-254 |
| `apps/planning-app/app/my-published` | Keep in planning-app, mirror UI into desktop | Marketplace read is already in planning-app |
| Dashboard surfaces | Extract to `packages/dashboard-surfaces` OR import planning-app routes into Tauri webview | Decision point for 52-01 |

Deferred: is the Tauri frontend a separate Next app or does it mount the
existing planning-app? Per `gad-269`, planning-app is operator-UI source
of truth. Two approaches:
(a) Tauri webview points at `http://localhost:<port>` running a bundled
planning-app. Heavier but zero UI duplication.
(b) Tauri ships a minimal Next frontend that imports shared components
from `packages/*`. Lighter, requires factoring out shared surfaces first.

Leaning (a) for MVP — launch bundled planning-app as a Tauri sidecar
process, webview to localhost. Ship. Iterate to (b) only if performance
or bundle size demands.

## Skills consolidation (parked)

Per operator: audit installed skills (`.claude/skills/`), migrate
phase-local / rarely-used to MCP-served on-demand (via `gad skill
list/find/show` MCP tools already shipped). Not today — scoped as a
follow-up phase.

## What I won't do today

- Rebuild v1.35.0 SEA exe (pipeline is broken; Bun is the path forward).
- Use `node bin/gad.cjs` for normal ops (only for debugging source-only
  issues, with explicit callout).
- Scaffold Tauri app before phase 66-01 (loader fix) lands — desktop
  phase depends on a healthy CLI.

## Sequencing

1. **Phase 66** — CLI hygiene + loader fix (blocks everything). First
   task: fix `_loader.cjs` to work in bundled Bun exe (static manifest
   generation at build time).
2. **Phase 52** — editor-core package (no CLI dependency, can start in
   parallel).
3. **Phase 53** — desktop shell (depends on 52 + a working gad.exe).
4. **Phase 51** — mark remaining tasks done, verify publish flow end-to-end.

## Open decisions surfaced to operator

(All default leans noted; operator accepts or overrides.)

- D1: Tauri UI approach — (a) bundled-planning-app sidecar vs (b)
  lightweight Next frontend with shared components. **Lean: (a) MVP.**
- D2: Editor-core data source adapter — local FS only MVP, or FS+Supabase
  from day one? **Lean: local FS MVP; adapter stub for Supabase but no
  implementation.**
- D3: Desktop release bundling — include gad.exe inside the Tauri MSI,
  or always download on first-run? **Lean: download on first-run, always
  current version.**
- D4: Code signing — defer unsigned MSIs for internal testing, or block
  on Authenticode cert? **Lean: defer; ship unsigned dev-channel now.**
