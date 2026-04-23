---
id: h-2026-04-23T14-09-33-get-anything-done-53
projectid: get-anything-done
phase: 53
task_id: 53-02
created_at: 2026-04-23T14:09:33.646Z
created_by: unknown
claimed_by: team-w1
claimed_at: 2026-04-23T15:21:22.123Z
completed_at: null
priority: normal
estimated_context: mechanical
runtime_preference: codex-cli
---
# 53-02 — Tauri sidecar binding for gad.exe

**Goal:** Make gad.exe available to apps/desktop (Tauri) as a sidecar resource + Rust command wrappers. Final task blocking phase 53 close.

**Changes needed:**

1. **apps/desktop/src-tauri/tauri.conf.json** — declare gad binary as sidecar resource. Use `bundle.externalBin` or `bundle.resources` to copy gad.exe into the packaged app. Reference: Tauri 2 externalBin docs (binary must be target-triple-suffixed at build time).

2. **apps/desktop/src-tauri/src/main.rs** — `#[tauri::command]` wrappers for common gad subcommands. At minimum:
   - `gad_projects_list() -> Result<Value, String>` → spawns `gad projects list --json`
   - `gad_publish_list() -> Result<Value, String>` → `gad publish list --json`
   - `gad_skill_list() -> Result<Value, String>` → `gad skill list --json`
   - `gad_generic(args: Vec<String>) -> Result<String, String>` → generic escape hatch, spawns `gad <args>` and returns stdout (for commands without JSON mode)
   Use `tauri::api::process::Command::new_sidecar("gad")` to invoke. Parse stdout JSON and surface errors cleanly.

3. **apps/desktop/src/lib/gad.ts** (new) — TS wrapper invoking the Rust commands via `import { invoke } from '@tauri-apps/api/core'`. Typed return values per command.

4. **Binary placement:** scripts/prepare-desktop-sidecar.mjs (new or extend existing) copies %LOCALAPPDATA%/Programs/gad/bin/gad.exe → apps/desktop/src-tauri/binaries/gad-x86_64-pc-windows-msvc.exe before tauri build. Cross-platform: emit gad-<target-triple>.exe for each build target.

**Acceptance:**
- `pnpm --filter @portfolio/desktop tauri dev` launches, dev panel can call `invoke('gad_projects_list')` and receive projects list.
- `tauri build` succeeds on Windows, packaged app bundles gad.exe and runs it via sidecar.
- Security: only the 4 commands above are exposed. Generic escape hatch is dev-mode-only (gated via `#[cfg(debug_assertions)]` or allowlist).

**Verification constraint:** use `node vendor/get-anything-done/bin/gad.cjs`. Pre-commit hook retired.

**Stamp** 53-02 done. After this, phase 53 closes (all 20 tasks done).