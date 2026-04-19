# Phase 64.B TUI — handover at session end

For the next claude-code session that picks this up. Operator paused mid-flight to free
context; everything below is committed to root + reflects state at handover.

## Where the work lives

`packages/gad-tui/` — workspace pkg `@magicborn/gad-tui`. 36 source files, ~3100 LOC.
No `node_modules` yet (deps not installed; smoke runs via bun on stdlib).

## What's DONE in 64.B

| Layer | State |
|---|---|
| Runtime adapter interface | `src/runtimes/types.ts` — RuntimeAdapter, RuntimeSession, RuntimeEvent, RuntimePermissionMode |
| Adapters (5) | `claude.ts` (stream-json, --permission-mode), `codex.ts` (exec --auto), `cursor.ts` (pty), `gemini.ts` (--prompt), `opencode.ts` (pty) |
| pty helper | `_pty.ts` — lazy-loads `node-pty` (optional dep); strip-ansi |
| Coordinator | `coordinator/SessionWatcher.ts` (ring buffer + multicast + summary), `SessionStore.ts` (singleton registry, 1s evict sweep) |
| TUI shell | `App.tsx` with Banner / CoordinatorTaskPanel / Transcript / Input / SlashPalette / FooterPanel / StatusBar |
| Banner | Block-letter "GAD" wordmark, magenta→**red** sigil pulses, top row hue-sweeps once on mount |
| Slash palette | Combobox below input — slash + gad subcommands + skills (lazy from `gad skill list`); `/`-triggered |
| Footer panel | Min-height 4, no box, single bottom `─` divider; ephemeral via `pushFooter()` |
| Input | No side borders, top divider, fixed cursor positioning, multi-line via Shift+Enter, @-mention picker, Ctrl+A/E/U |
| Status bar | Folder basename only, model + context window in brackets, attached-session token meter (gold/red gradient at 65%/85%), permission mode display |
| Animations | Augment layer at `ink-extensions/` — `useAnimationFrame` (shared 50ms clock), `<AnimatedGlyph>`, `<HueSweep>`, `<Pulse>` — NOT a source-fork of ink (decision below) |
| VCS-text | `src/vcs/Cid.tsx` — `<CidTag>` + `<CidProvider>`, toggle via `/cids on\|off\|toggle` or `GAD_TUI_CIDS=1` env. Every region carries a stable `tui:*` cid |
| Theme | `src/theme.ts` — black/gold/red palette. Hex gold `#D4A017` (primary), `#FFD700` (bright), `#8C6E10` (dim), red `#C92A2A`. **Zero blue/cyan/magenta** in src/ |
| Permission mode | `src/agent/permissionMode.ts` — cycle on **Shift+Tab** (default→acceptEdits→bypassPermissions→plan). App-level `useInput`. StatusBar shows `[? ask]` etc, red on bypass |
| Permission pass-through | `RuntimeSessionOptions.permissionMode` flows to claude (`--permission-mode`) and codex (`--auto` for accept/bypass). Other adapters: pending the actual flag mapping |
| Smoke | `bun packages/gad-tui/src/smoke.ts` (gad-snapshot round-trip via stdlib) — green |
| Runtime probe | `bun packages/gad-tui/src/runtimes-smoke.ts` — reports installed/missing per runtime + node-pty status |
| tsc | `bunx tsc --noEmit` clean (exit 0) — archive `*.archive.ts` excluded |

## What's NOT done in 64.B

| Item | Why open |
|---|---|
| **Real non-slash dispatch wire** | `App.tsx handleAgentMessage` still shows the placeholder. Needs: default-runtime state + `/runtime <id>` slash to set it + routing non-slash submits through `getAdapter(default).start({prompt, permissionMode, …})` + replacing the placeholder branch. **This is the next concrete coding task.** |
| Codex/cursor/gemini/opencode permissionMode mapping | Only claude maps directly. Others need real flag research per CLI version |
| node-pty install | optional dep; cursor/opencode unusable until `pnpm add node-pty -F @magicborn/gad-tui`. Needs platform build tools (MSVC on Windows) |
| Live testing of adapter parsing | Each adapter's stdout shape is assumed (claude verified via stream-json; others speculative). Spawn each, verify event normalization |
| Auto-routing from handoff queue | Per gad-274 plan: when operator picks a handoff, auto-spawn its `runtime_preference` (after one keystroke confirm). Plumbing not started |
| Markdown edge cases | Inline parser handles bold/italic/code/url/path/slash/skill, but doesn't do tables, blockquotes, nested lists, or images |

## Architectural calls already made (don't relitigate)

- `gad-272`: pivot to free-code as CLI face (initial)
- `gad-273`: A+B path — bun-build (codex shipped) + thin TUI on Anthropic SDK
- `gad-274`: **supersedes 273** — runtime-agnostic, NOT Claude-bound. free-code is reference-only at `tmp/free-code/` (IP + stripped-guardrails risk). npm tarball stays for skill/hook/agent install; only SEA exe build deprecated. CLAUDE.md scope = file-ref deltas only
- Animation: augment layer not source-fork ink (operator approved). If a real wall hits, do source fork at `packages/ink-gad/`

## Operator UX preferences captured

- Black / gold / red palette only — no blues/cyans/magentas
- Minimal placeholder text in input
- Footer panel: just bottom border, min-height stable layout
- Input: no side borders, top divider only
- Status bar: folder basename (not full path), model with context window size, context meter
- Initial transcript empty; banner is the orientation
- `/cids` for VCS-text overlay (off by default, dim tags when on)
- Slash palette combobox style; type to dwindle; mixed slash + gad + skill in one list

## Recommended pickup order (next session)

1. Read this file end-to-end (~10 min)
2. `gad startup --projectid get-anything-done` for orientation
3. `bun packages/gad-tui/src/smoke.ts` to confirm baseline still green
4. Wire the real non-slash dispatch (the open item) — ~1 hr
5. Either: live-test the adapters by dispatching each; OR: continue with markdown polish / handoff auto-routing

## Cross-references

- `vendor/get-anything-done/.planning/notes/2026-04-18-phase-64-cli-pivot-plan.md` — full A+B plan note
- DECISIONS: `gad-272`, `gad-273`, `gad-274`
- Memory: `feedback_zero_deps_first`, `feedback_visual_context_system_mandatory`, `feedback_compact_response_format`, `feedback_offload_to_cheaper_models`
- Reference (read-only, IP-sensitive): `tmp/free-code/src/components/`, `tmp/free-code/src/components/LogoV2/`, `tmp/free-code/src/components/StatusLine.tsx`, `tmp/free-code/src/components/CoordinatorAgentStatus.tsx`
- Adapter contract: `packages/gad-tui/src/runtimes/types.ts`
- Theme: `packages/gad-tui/src/theme.ts`

## Signed
— Kael of Tarro / claude-code, 2026-04-18 end-of-session
