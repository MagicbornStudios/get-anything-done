# scaffold-tauri-desktop-shell — workflow

Building a Tauri 2.x desktop shell that wraps an existing planning-app
+ gad CLI requires sidecar binding, first-run dependency detection,
PTY-backed terminal, Clerk auth threaded into the spawn env, MSI build
in CI, and packaged shared-surface extraction. Phase 53 shipped 18 of
19 tasks; the reusable shape is the bundled-planning-app sidecar +
sidenav + cross-host package extraction model.

## When to use

- Building a Tauri 2.x desktop app that should reuse a Next.js
  planning-app web surface as its primary UI.
- Wrapping a CLI binary as a Tauri sidecar with typed Rust commands.
- Packaging xterm.js + node-pty terminal-as-chat into a desktop shell.

## When NOT to use

- For pure Electron apps (different sidecar model).
- For mobile/Tauri-mobile — Windows-only here.
- For web apps that don't need OS-level integrations.

## Steps

1. Scaffold via `bun tauri init`. Lock to `windowsOnly` in tauri.conf.json
   first (Windows x64). Cross-platform comes after the Windows happy path.
2. Sidecar binding for the CLI:
   - Declare gad.exe as a sidecar resource in `tauri.conf.json`.
   - Rust `#[tauri::command]` wrappers for common subcommands (`projects
     list`, `publish list`, `skill list`, `tasks list`) using `gad --json`
     output.
   - Frontend hook `useGadCommand()` wraps `invoke()` with loading/error
     state.
3. First-run flow (per task 53-03):
   - Detect `claude` CLI on PATH; if missing show one-click winget
     install (Anthropic.Claude).
   - Detect `gad.exe` on PATH; if missing download latest from GitHub
     Releases into app data dir.
   - Cache detection per-session; provide a settings toggle to skip.
4. Bundled planning-app sidecar (per 53-04):
   - Tauri spawns `apps/planning-app` Next production server as a child
     process on an ephemeral port.
   - Webview points at `http://localhost:<port>`.
   - Shut down child on app quit.
   - Measure startup time; if >3s, evaluate a leaner runtime.
5. Terminal panel:
   - xterm.js + node-pty (or Tauri PTY equivalent).
   - Slide-out panel toggleable via keyboard shortcut.
   - Implements terminal-as-chat (decision gad-253) — stdout streams to
     a chat-style transcript, stdin is the prompt input.
   - PTY ownership: `Arc<Mutex<>>` pattern so writer/reader lifetimes
     work with async tasks (per task 53-18).
6. Sidenav (per 53-06):
   - Dashboard / Projects / Bestiary / Publish / Settings.
   - Each tab routes to either planning-app URL (via sidecar from 53-04)
     OR a Tauri-native surface (publish wizard, settings).
   - Keyboard navigation `Cmd+1..5`.
7. Publish wizard fronting `gad publish` CLI (per 53-07):
   - Steps: pick project → pick generation (from MANIFEST.json per
     gad-270) → review manifest → confirm → invoke `gad publish set`
     via sidecar binding → show progress.
   - Uses Clerk operator-id for attribution (per 53-08, threaded via env
     into the sidecar).
8. CI (per 53-09 + 53-10a):
   - GitHub Actions workflow building unsigned MSI on tag push.
   - `bun tauri build --target x86_64-pc-windows-msvc`.
   - Attach MSI to GitHub Release.
   - Authenticode signing deferred to operator (cert procurement).
   - Wire Tauri updater secrets (`TAURI_SIGNING_PRIVATE_KEY` +
     `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) so `latest.json` ships as a
     release asset.
9. Cross-host package extraction (per 53-11..53-16):
   - `packages/visual-context` — VCS primitives (SiteSection,
     CrudModalFooter, VisualContextProvider).
   - `packages/project-editor-surface` — project-editor UI mounted by
     desktop or planning-app.
   - `packages/bestiary-surface`, `packages/marketplace-surface`,
     `packages/publish-surface` — same pattern.
   - Each package decouples UI from data via an Adapter interface so
     desktop can use a CLI-backed adapter and web can use the file-index
     adapter.

## Guardrails

- Sidecar startup must be tracked. >3s = abort the bundled-planning-app
  approach and revisit (fork a leaner shell or adopt pure Tauri-native UI).
- Authenticode signing deferred ≠ ignored. Track as a HUMAN-TODO with
  a date so unsigned MSIs don't ship indefinitely.
- icon.ico format: use `pnpm tauri icon <source.png>` (all sizes from a
  PNG source) — hand-converted .ico files crash tauri-winres / RC.EXE
  with placeholder DIB formats (per task 53-17).
- Lifetime errors in pty.rs: every `cargo check` regression gates the
  CI build. Fix lifetimes (Arc<Mutex<>>) before any behavior change.
- Marketplace adapter: never reach through to the file-system adapter
  from a Tauri-only path. Route every read through the adapter prop.

## Failure modes

- **`cargo check` panics on icon.** Run `pnpm tauri icon` to regenerate.
- **Sidecar Next server fails to start.** Confirm production build was
  run (`pnpm --filter @portfolio/planning-app build`) before packaging.
- **Webview points at wrong port.** Sidecar port is ephemeral — read it
  from sidecar stdout, don't hardcode.
- **PTY crashes with E0597 lifetime errors.** Restructure to
  `Arc<Mutex<Writer>>` so the writer reference outlives the lock scope.
- **MSI artifact missing from release.** Workflow upload step uses
  glob; confirm the MSI path matches and that `latest.json` is also
  uploaded as a release asset.

## Reference

- Decisions gad-253 (terminal-as-chat), gad-269 (planning-app =
  operator), gad-270 (MANIFEST.json publish flow), gad-271 (Clerk).
- Phase 53 tasks 53-01..53-19.
- `frontend-design` skill for Tauri-native surface quality.
- `vercel:auth` for Clerk integration patterns.
