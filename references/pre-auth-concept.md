# Pre-auth: log in once, every surface reuses the captured credential

Phase 110 task `GLOBAL-T-110-07` (design).
Date: 2026-05-19.

## Problem

Every coding-agent runtime (codex-cli, gemini-cli, claude-code,
opencode) has its own OAuth flow. By default each runtime checks for
its canonical file (e.g. `~/.codex/auth.json`) and triggers an
interactive `<runtime> login` when missing. This breaks every
headless surface:

- gad team workers spawn the runtime as a child process. If the
  canonical file is absent the child runtime opens a browser — but the
  operator never sees the prompt and the worker hangs.
- CI / cron / scheduled background runs cannot drive a browser at all.
- The Tauri desktop sidecar uses bundled `gad.exe`. When it spawns a
  runtime that needs OAuth, the browser launches inside Tauri's hidden
  window context and the redirect callback is never received.
- Multi-machine: the operator authenticates on machine A; machine B
  starts fresh and needs the same login again, even though the
  refresh token would work on both.

## Design: capture-once, reuse-from-registry

The phase 110 substrate already implements this pattern. This doc
spells it out as a first-class concept so future surfaces (desktop,
TUI, CI runner) wire it correctly.

### The contract

1. **One human-driven login per credential.** The operator runs
   `gad accounts login <provider> --label <name>` (or
   `gad accounts add <provider> --label <name>` if the runtime is
   already logged in). This is the only step that opens a browser.
2. **Capture into the GAD registry.** The credential file is copied
   from the runtime's canonical path into
   `~/.gad-credentials/<provider>-<label>.json` and a record is
   written into `.planning/team/runtime-accounts.json` plus the global
   registry `~/.gad-credentials/registry.json`.
3. **Every subsequent surface reads from the registry.** No surface
   should ever prompt for OAuth itself if a registry entry exists. The
   surface either:
   - Calls `gad accounts use <provider> --label <name>` to restore the
     credential to the canonical path before invoking the runtime
     (CLI / one-off path), or
   - Stages the credential into a per-worker isolated directory via
     `stageFileBackedAccount` (gad team worker path — already shipped
     in `lib/team/rate-limit.cjs`).
4. **Refresh-token rotation stays inside the runtime.** When the
   captured access token expires, the next runtime invocation refreshes
   it in-place at the canonical path. The next `gad accounts add` re-
   captures the updated file. We do not implement a refresh proxy —
   each runtime owns its own refresh semantics.

### Surface contract

Every surface that spawns a coding-agent runtime MUST:

| Surface | Pre-auth call | Where the credential lands |
|---|---|---|
| `gad team` worker | `stageFileBackedAccount` (auto) | `.planning/team/workers/<id>/accounts/<runtime>/<label>/<file>` (env-pointed via `CODEX_HOME` / `GEMINI_CONFIG_DIR`) |
| `gad runtime launch` | `gad accounts use` (if needed) | canonical path (e.g. `~/.codex/auth.json`) |
| Tauri desktop sidecar | inherits ambient env from `gad` parent → uses staged worker dir if invoked through `gad team`; otherwise canonical path | same |
| CI / cron | operator pre-stages by checking in encrypted `~/.gad-credentials/` snapshot OR injecting via secrets manager | wherever `GAD_RUNTIME_ACCOUNT_FILE` env-var points |

### What this is NOT

- **NOT a credential proxy.** We don't intermediate the runtime's API
  calls — they go directly to the provider. The registry is purely
  about where the credential file lives and which one is active.
- **NOT a token refresher.** Refresh happens inside the runtime
  (codex/gemini/claude/opencode binaries do this themselves on
  expiration). GAD just keeps the file in a known location.
- **NOT cross-runtime SSO.** Logging in to gemini does not log in to
  codex. Each provider needs its own initial human-driven login.

### Cross-machine workflow

For multi-machine teams (operator + remote agent):

```
machine-A$  gad accounts login codex --label primary
machine-A$  ls ~/.gad-credentials/
codex-primary.json   registry.json

# Copy ~/.gad-credentials/ to machine-B via secure transport
# (git-crypt'd repo, rsync over Tailscale, 1Password vault, etc.)

machine-B$  gad accounts list
codex/codex-cli
  - primary (active, oauth-file)
```

The registry IS the cross-machine sync surface. As long as
`~/.gad-credentials/` stays in sync, every machine sees the same
account pool.

### Connection to multi-account rotation (110 substrate)

When the active account hits a rate-limit, `rotateRuntimeAccount`
advances to the next usable account WITHOUT re-prompting — because all
accounts are already captured. This is what makes the multi-account
substrate actually work in headless contexts: a worker on a 6-hour
overnight run doesn't stall waiting for a human to log in to the next
account, because the next account is already in the registry.

If no usable account remains (all rate-limited, all paused, or none
captured), the worker requeues the handoff for another runtime to pick
up. The operator is surfaced via:

- `gad accounts list --provider <p>` (manual check)
- `gad accounts hints` (sliding-window detection)
- `gad accounts poll` (auto-flip rate-limited → active when reset_at
  passes — wired phase 110-01)

## Implementation status (2026-05-19)

| Step | Surface | Status |
|---|---|---|
| 1. one human-driven login | `gad accounts login` | shipped (110-03) |
| 2. capture into registry  | `gad accounts add`   | shipped (110-03) |
| 3a. reuse via `gad accounts use` | CLI | shipped (110-04) |
| 3b. reuse via team-worker staging | team worker | shipped (110-12) |
| 4. refresh-in-place        | implicit (runtime own) | shipped (registry preserves file mtime) |

The pattern is fully implemented in the CLI surface. The gap is
**operator awareness** — there is no Tauri-desktop UI yet that walks
the operator through the capture flow. Phase 110-08 (AccountsManager
UI surface, deferred — see notes there) is the visible-substrate side
of this contract.

## Cross-refs

- `references/multi-account-fallback.md` — phase 87 fallback substrate
- `bin/commands/accounts.cjs` — CLI implementation
- `lib/team/accounts-registry.cjs` — registry shape
- `lib/team/rate-limit.cjs::stageFileBackedAccount` — worker staging
