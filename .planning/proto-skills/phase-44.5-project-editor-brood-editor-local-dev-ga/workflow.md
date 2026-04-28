# scaffold-local-dev-editor-bridge — workflow

Local-dev authoring surfaces (Project Editor, Brood Editor, any agent
workspace that needs to invoke `gad`/`npx` from the browser) require the
same three primitives: a NODE_ENV gate, a dev-server command bridge, and
a file-system round-trip adapter. Phase 44.5 (earlier snapshot)
established the canonical pattern.

## When to use

- Building a new dev-only authoring surface that needs to spawn CLI
  commands and stream output to the browser.
- Adding live-edit support for project files (requirements.md, gad.json,
  manifests) from a UI surface.
- Replacing an ad-hoc subprocess invocation with a guarded bridge.

## When NOT to use

- For any production-facing surface — the bridge MUST never ship to prod.
- For static read-only views (use server-component fetching instead).
- For long-running interactive shells — use xterm.js + node-pty (phase
  53 pattern), not the SSE bridge.

## Steps

1. Scaffold the route under `apps/<host>/app/<surface>/`. Gate at the
   page level via `process.env.NODE_ENV === 'development'` checks
   AND at the API route level via module-load-time rejection.
2. Build the three-pane viewport shell BEFORE any feature work:
   - left pane (placeholder)
   - right pane (placeholder)
   - bottom/inspector pane (placeholder)
3. Every pane gets an explicit `SiteSection cid="<surface>-<pane>-site-section"`
   literal. Cid must be greppable as a string, not computed.
4. Round-trip ONE modal-footer CRUD prompt against a pane cid BEFORE
   wiring any feature. Proves the Visual Context System is live; if it
   fails here, every subsequent feature inherits the bug.
5. Build the dev-server command bridge (per task 44.5-02 then 44.5-02b):
   - **First cut (permissive)**: accept any `gad *` and any `npx *` command,
     stream stdout/stderr via SSE, reject if NODE_ENV !== 'development'
     at MODULE LOAD (not request time).
   - **Hardening pass**: replace permissive accept with explicit
     allow-list (`gad evolution status|validate|promote|discard`,
     `gad snapshot`, `gad state`, `gad tasks`, `npx <eval-scoped>`,
     `pnpm|npm|yarn install/build/test`). Add argument sanitization,
     per-command timeout tuning, structured error responses.
6. Build the file-system round-trip adapter (per 44.5-03):
   - Read/write requirements.md, gad.json, per-species overrides, manifest
     entries for the currently-selected project.
   - Same NODE_ENV gate as the bridge, but a separate route family —
     don't conflate file edits and command spawns.
7. Wire the visible "(dev mode)" dev-panel badge so the operator sees
   the gate status without checking environment manually.
8. Add the "Open in Editor" CTA on the corresponding listing detail
   page, visible only in dev. Provide a reverse "Exit to listing" link
   from the editor shell. Both get cids and participate in VCS.

## Guardrails

- Module-load-time NODE_ENV rejection is non-negotiable — request-time
  rejection can be bypassed by misconfigured proxies.
- Permissive bridge is only for the spike — every PR after the editor
  proves out MUST add the allow-list.
- Never ship the bridge tree behind a feature flag in prod. Files like
  `apps/.../api/dev/spawn/route.ts` should hard-fail at build time when
  `NODE_ENV === 'production'`.
- When extending file-system round-trip, scope reads to the current
  project's tree only. Path-traversal protection must be explicit (per
  task 60-07b's env-defaults-store pattern).

## Failure modes

- **SSE stream hangs on Windows.** Codex/gemini hooks emit empty stderr
  for minutes — confirm subprocess inherits PTY or use line-buffered
  pipes. See ERROR codex-hooks-hang-detached-worker-2026-04-22.
- **VCS round-trip fails on first scaffold.** Cid was computed; convert
  to literal. See `gad-visual-context-panel-identities` skill.
- **Allow-list misses an in-use command.** Operator surfaces a 403 from
  the bridge — extend the allow-list explicitly, never wildcard back to
  permissive.
- **Bridge spawned subprocess inherits parent process.env including
  secrets.** Use `lib/scoped-spawn.cjs` from phase 60 to scope env per
  project.

## Reference

- Decisions gad-186/187/189 (VCS), gad-198 (skill lifecycle).
- Phase 44.5 tasks 44.5-01, 44.5-02, 44.5-02b, 44.5-03.
- Phase 60 task 60-04 (`lib/scoped-spawn.cjs` for env scoping).
- `scaffold-visual-context-surface` skill — runs first.
- `gad-visual-context-system` skill — overarching mandate.
