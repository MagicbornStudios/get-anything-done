---
status: candidate
source_phase: "53"
source_phase_title: "apps/desktop Tauri shell — editors + terminal-as-chat + CLI bridge"
pressure_score: 38.26
tasks_total: 19
tasks_done: 18
crosscuts: 4
created_on: "2026-04-23"
created_by: compute-self-eval
---

# Candidate from phase 53

## Phase

```
get-anything-done | 53 | apps/desktop Tauri shell — editors + terminal-as-chat + CLI bridge
selection pressure: 38.26  (19 tasks, 18 done, 4 crosscuts)
```

## Tasks

```
53-01 done Scaffold apps/desktop with Tauri 2.x, Windows x64 target only. Next.js frontend (or Vite+React if Next adds bundle weight — decide during scaffold). tauri.conf.json pinned to windowsOnly. Minimal hello-world window launches via &apos;bun tauri dev&apos; and produces unsigned MSI via &apos;bun tauri build&apos;.
53-02 planned Tauri sidecar binding for gad.exe. src-tauri/tauri.conf.json declares gad binary as sidecar resource. Rust #[tauri::command] wrappers for common subcommands (projects list, publish list, skill list, tasks list) returning parsed JSON (gad --json flag). Frontend hook useGadCommand() wraps invoke() with loading/error state.
53-03 done First-run flow: on launch, detect claude CLI on PATH — if missing, show install prompt with one-click winget install Anthropic.Claude. Detect gad.exe on PATH — if missing, download latest from GitHub Releases into app data dir. Cache detection result per-session. Skippable via settings toggle.
53-04 done Bundled planning-app sidecar approach (D1 lean): Tauri spawns apps/planning-app Next production server as child process on ephemeral port, webview points at http://localhost:&lt;port&gt;. Shuts down child on app quit. Advantage: zero UI duplication, planning-app stays single source of truth (gad-269). Measure startup time; if &gt;3s, revisit.
53-05 done In-app terminal panel using xterm.js wired to child PTY (node-pty or Tauri equivalent). Runs claude or gad as shell. Implements terminal-as-chat (decision gad-253). Slide-out panel, toggleable via keyboard shortcut.
53-06 done Sidenav: Dashboard / Projects / Bestiary / Publish / Settings. Each tab routes to planning-app URL (via bundled sidecar from 53-04) OR Tauri-native surface (publish wizard, settings). Keyboard navigation (Cmd+1..5). Icons via shared packages/icons or inline SVG.
53-07 done Publish wizard UI fronting existing &apos;gad publish&apos; CLI (phase 51 task 51-07). Steps: pick project → pick generation (from MANIFEST.json per gad-270) → review manifest → confirm → invoke &apos;gad publish set&apos; via sidecar binding (53-02) → show progress. Uses Clerk operator-id for attribution.
53-08 done Clerk auth integration in Tauri frontend per gad-271. Solo-operator fallback for local dev (signed out = operator-id &apos;local&apos;). Auth state syncs into sidecar env so gad publish CLI inherits GAD_OPERATOR_ID.
53-09 done GitHub Actions workflow building unsigned MSI on tag push. Workflow: checkout → install bun + rust → &apos;bun tauri build --target x86_64-pc-windows-msvc&apos; → attach MSI to GitHub Release. Authenticode signing deferred to HUMAN-TODO (cert procurement).
53-10 done Tauri built-in auto-updater. Update manifest hosted on GitHub Releases (tauri.updater endpoint). On launch, check for newer version; prompt user to download+restart. Signing keypair generated + embedded per Tauri 2 updater docs.
53-10a done Update .github/workflows/desktop-build.yml to wire Tauri updater signing secrets (TAURI_SIGNING_PRIVATE_KEY + TAURI_SIGNING_PRIVATE_KEY_PASSWORD) into &apos;pnpm tauri build&apos; env + upload the generated &apos;latest.json&apos; as a release asset.
53-11 done Extract Visual Context System primitives into packages/visual-context and apply to apps/desktop shell. Three outputs in one task. (1) Move apps/planning-app/components/site/SiteSection.tsx + siblings into new @portfolio/visual-context package. (2) Refactor apps/planning-app to import from @portfolio/visual-context. (3) Wrap apps/desktop App.tsx with VisualContextProvider + SiteSection + CrudModalFooter.
53-13 done Extract the project-editor UI from apps/platform/app/project-editor/[project]/page.tsx into packages/project-editor-surface so apps/desktop can mount the same surface via the shared package.
53-14 done Extract the bestiary UI from apps/platform/app/projects/edit/[id]/BestiaryTab.tsx into packages/bestiary-surface for cross-host reuse (apps/platform + apps/desktop).
53-15 done Extract apps/platform/components/marketplace/ into packages/marketplace-surface for cross-host reuse (apps/platform + apps/desktop). Create pluggable MarketplaceDataAdapter interface decoupling the marketplace UI from the file-based eval-data pipeline.
53-16 done Create packages/publish-surface — shared publish-wizard UI mountable by both apps/platform and apps/desktop. Unblocks task 53-07 (desktop publish wizard).
53-17 done Fix apps/desktop/src-tauri/icons/icon.ico format issue that blocks &apos;tauri build&apos; / &apos;cargo check&apos;. The 53-01 scaffold dropped a placeholder icon.ico whose DIB format causes tauri-winres + RC.EXE to panic. Regenerate the icon: either (a) use the Tauri CLI &apos;pnpm tauri icon &lt;source.png&gt;&apos; which generates all platform-appropriate icon sizes from a PNG source, or (b) hand-convert a properly-formatted .ico via ImageMagick / online tool. Source: any 512x512+ PNG — pick a simple black-and-gold GAD mark if no brand asset is available, or leave a README.md placeholder pointing at where to drop the real brand asset. Success: &apos;cd apps/desktop/src-tauri &amp;&amp; cargo check&apos; passes. Do NOT actually run &apos;cargo build&apos; or &apos;tauri build&apos; — check is enough.
53-18 done Fix pre-existing E0597 lifetime errors in apps/desktop/src-tauri/src/pty.rs. Discovered during task 53-17 icon fix and confirmed in 53-08 Clerk wiring — &apos;cargo check&apos; still fails on 2 lifetime errors after both unrelated fixes landed. Root cause likely: the PTY writer is taken+stored on the async task but the session map lock scope doesn&apos;t outlive the reader thread. Re-structure so writer/reader references have &apos;static-compatible lifetimes (Arc&lt;Mutex&lt;&gt;&gt; pattern). Success: &apos;cd apps/desktop/src-tauri &amp;&amp; cargo check&apos; exits 0. Unblocks &apos;cargo build&apos; / &apos;tauri build&apos; / CI (task 53-09). Do NOT refactor pty.rs behavior — fix lifetimes only, keep the four commands (pty_open/write/resize/close) identical.
53-19 done Decouple @portfolio/marketplace-surface from hard @gad-site/lib/eval-data imports so the desktop app (Tauri) can mount ProjectMarket end-to-end. Task 53-06 discovered that use-project-market.ts + the *Band components still reach through to the vendor site&apos;s eval-data via alias, bypassing MarketplaceDataAdapter. Fix: route EVERY data read through the adapter prop. Keep FileIndexAdapter as the current web-side default; the SupabaseAdapter stub gets filled out (uses publishes join to projects/species/generations). Desktop uses an adapter backed by a gad CLI invoker (future: &apos;gad marketplace list --json&apos;). Result: MarketplaceRoute on desktop renders the full marketplace grid instead of the minimal list fallback.
```

## What this candidate is for

This file was auto-generated by `compute-self-eval.mjs` because phase
53 exceeded the selection pressure threshold. High pressure
signals a recurring pattern that may want to become a reusable skill.

This is the **raw input** to the drafting step. The drafter (`create-proto-skill`,
invoked by `gad-evolution-evolve`) reads this file and decides what the
skill should be. No curator pre-digestion happens — see the 2026-04-13
evolution-loop experiment finding for why
(`evals/FINDINGS-2026-04-13-evolution-loop-experiment.md`).

## How the drafter should enrich this

The drafter should pull additional context from:

- `gad decisions --projectid get-anything-done | grep -i <keyword>` —
  relevant decisions for this phase
- `git log --follow --oneline <file>` — historical context for files this
  phase touched (catches the "three attempts at task X failed" thread that
  lives in commit history)
- `gad --help` and `gad <subcommand> --help` — CLI surface available
  to the skill
- `ls vendor/get-anything-done/skills/` — existing skills to avoid
  duplicating

The drafter does **not** ask a human for anything. Make decisions and
document them in the SKILL.md.

## Output location

The drafter writes to `.planning/proto-skills/phase-53-apps-desktop-tauri-shell-editors-termina/SKILL.md` — a
**different directory** from this candidate. Candidates and proto-skills
are two distinct stages:

- **candidate** (this file) = raw selection-pressure output
- **proto-skill** (drafter output) = drafted SKILL.md awaiting human review
- **skill** (post-promote) = lives in `skills/` as part of species DNA

The human reviewer runs `gad evolution promote <slug>` or
`gad evolution discard <slug>` after reviewing the proto-skill.
