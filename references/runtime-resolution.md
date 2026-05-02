# Runtime resolution — always-packaged-first

**Decisions:** GLOBAL-D-292 (operator + Gilgamesh ratification)
**Operator directive:** 2026-05-02 — "we typically want packaged versions of the runtimes to be used anyway, but keeping them up to date most of the time."

GAD ships against multiple coding-agent CLIs (claude-code, codex-cli, gemini-cli, opencode, cursor-cli). Each has three install vectors and we treat them in a strict preference order: **vendored > user-local > global PATH.**

## The order

| Priority | Source | Location | Why |
|---|---|---|---|
| 1 | **Vendored / pinned** | `tmp/<runtime>/` (gitignored, but version-pinned via a manifest) | Reproducible — same binary across machines + sessions. No "works on my box" drift. |
| 2 | **User-local install** | OS conventions: `%LOCALAPPDATA%\<runtime>\` (Win), `~/.local/share/<runtime>/` (*nix), `~/Library/Application Support/<runtime>/` (macOS) | Operator's manual install. Stable across pnpm reinstalls. |
| 3 | **Global PATH** | `which <runtime>` | Last-resort. Subject to PATH drift, version surprises, multiple installs. |

If none of those resolve and the runtime has a published npm/pnpm package (e.g. `@google/gemini-cli`), the wrapper script may invoke it via `pnpm dlx` as a final fallback. This downloads-on-first-use and warms a pnpm cache; subsequent calls are local.

## Wrapper-script pattern

Each runtime has a `scripts/gad-<runtime>-trial.mjs` wrapper that:

1. `loadRepoRootEnv(repoRoot)` — pulls `.env` so the runtime's API keys are visible.
2. `resolve<Runtime>()` — walks the preference order above.
3. `spawnSync(binary, passthroughArgs, { stdio: "inherit", shell: isWin })` — forward stdout/stderr to the parent process.

Reference implementations:

| Runtime | Wrapper | Adapter |
|---|---|---|
| gemini-cli | `scripts/gad-gemini-trial.mjs` | `scripts/runtime-adapters/gemini-cli.mjs` |
| cursor-cli | `scripts/gad-cursor-trial.mjs` | `scripts/runtime-adapters/cursor-cli.mjs` |
| codex-cli | (TODO — currently relies on global `codex`) | `scripts/runtime-adapters/codex-cli.mjs` |
| opencode | (TODO) | `scripts/runtime-adapters/opencode.mjs` |
| claude-code | (handled by Claude Code itself; no wrapper needed) | `scripts/runtime-adapters/claude-code.mjs` |

## Update ritual

A runtime stays current via three layers:

1. **On invocation:** wrapper script lazily detects "vendored too old" by hashing the binary or reading a `tmp/<runtime>/version.txt`. If a newer release is pinned in `runtime-versions.json`, the wrapper auto-fetches.
2. **Daily check (phase 95):** `scripts/runtime-version-check.mjs` polls each provider's release feed (npm versions or GitHub releases). Opens a handoff if a major version landed.
3. **Manual:** operator runs `gad runtime update --runtime <id>` (future) — re-pins to the latest release in `runtime-versions.json` and clears the vendored binary.

## Why this matters

- **Reproducibility.** Two operators on the same task using the same runtime should produce the same trace shape. Global-PATH installs drift (system vs nvm vs pnpm-shipped); vendored doesn't.
- **CI/CD.** Vercel deploys + GitHub Actions can ship a `tmp/<runtime>/` cache key. PATH installs require a separate setup step per runtime.
- **Auditability.** When a runtime regression hits a phase, knowing the exact version is the first debug step. Vendored answers immediately.

## Known gaps (2026-05-02)

| Gap | Impact | Where |
|---|---|---|
| `runtime-versions.json` not yet authored | No pinned canonical versions; wrappers fall through to global PATH | Phase 95 task |
| `gad runtime update` not implemented | Manual update still requires direct `npm i -g` | Phase 95 task |
| `tmp/<runtime>/` directories not created at install time | Wrappers always fall through to user-local + PATH | Phase 95 task |
| codex-cli + opencode wrappers not authored | Those runtimes use raw global PATH today | Phase 95 backlog |

## Operator-side install commands (current state)

```sh
# gemini-cli — auto-pulls via pnpm dlx if absent (gad-gemini-trial wrapper)
node scripts/gad-gemini-trial.mjs -- --version

# cursor-agent — installer at https://cursor.com/agent
# Resolves at %LOCALAPPDATA%\cursor-agent\cursor-agent.cmd on Windows
'/c/Users/benja/AppData/Local/cursor-agent/cursor-agent.cmd' --version

# codex-cli — npm install (still relies on global PATH)
npm install -g @openai/codex-cli

# claude-code — installed via Claude Code app + CLI extension
```
