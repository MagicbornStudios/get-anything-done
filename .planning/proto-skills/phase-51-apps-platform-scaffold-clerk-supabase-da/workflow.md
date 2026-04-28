# scaffold-clerk-operator-attribution — workflow

When a platform app needs operator-attributed actions across UI,
subagent CLI, and headless workflows, the attribution model has to
thread through all three surfaces. Phase 51 wired Clerk + solo-operator
fallback + spawn env vars + CLI publish through one consistent
`getOperatorId()` resolver in 9 tasks.

## When to use

- Adding Clerk auth to a Next.js platform app with a publish/edit surface.
- Multi-runtime attribution: UI clicks, agent CLI calls, headless cron all
  need to stamp the same operator id.
- A new CLI command that mutates published artifacts (publish, revert,
  archive) needs operator attribution.

## When NOT to use

- For pure read-only auth (just use Clerk middleware).
- For non-platform apps (this skill assumes the planning-app/platform
  shape with a publish wizard).

## Steps

1. Install Clerk minimally:
   - `@clerk/nextjs` package.
   - Middleware that protects `/api/dev/*`, `/projects/edit/*`, and
     `/project-editor/*`.
   - `<UserButton />` in the AppShell header.
2. Solo-operator fallback (load-bearing for local dev without Clerk
   creds):
   ```ts
   export function getOperatorId(): string {
     const userId = auth().userId;
     if (userId) return userId;
     if (!process.env.CLERK_PUBLISHABLE_KEY) return 'solo-operator';
     throw new Error('Unauthenticated');
   }
   ```
3. Stamp operator id at every publish PATCH route. The MANIFEST.json
   entry carries `publishedBy: <operatorId>` and `publishedAt: <iso>`.
4. Subagent attribution (per task 51-03):
   - `/api/dev/spawn` route resolves operator via `getOperatorId()` and
     injects `OPERATOR_ID + GAD_OPERATOR_ID + GAD_AGENT_ID +
     GAD_AGENT_ROLE + GAD_PROJECT_ID` into child env.
   - `/api/dev/whoami` returns the same payload for client-side surfaces.
   - Subagent CLIs (claude-code, codex, gad eval run) echo identity from
     env.
5. Operator surfaces:
   - `/my-published` filters marketplace-index by `publishedBy === operatorId`.
   - Per-project best/latest score chips on species detail.
6. CLI parity (per task 51-07):
   - `gad publish <project> --species <name> --version <vN>` — resolves
     operator via env (set by spawn) or process owner, threads as
     `x-operator-id` header into the PATCH route.
   - `gad publish list` — read-only inspection, no auth needed beyond
     the file read.
7. UI vs CLI distinction (per task 51-09):
   - UI publishes stamp `via: 'ui'`.
   - CLI publishes stamp `via: 'cli'`.
   - Audit log distinguishes intent — operator click vs agent script.
8. Hot-rebuild marketplace-index on publish (per 51-05): mutate the
   existing index in place rather than re-scanning every TRACE.json.
   Preserve fields the publish PATCH can't recompute (score, date,
   contextFramework).

## Guardrails

- Solo-operator fallback is opt-in via missing-creds detection. Never
  ship a build to prod with `CLERK_PUBLISHABLE_KEY` unset — the fallback
  exists for local dev only.
- Subagent env vars carry the human operator id, not the agent runtime
  id. The agent's role goes in `GAD_AGENT_ROLE`; the human's id goes in
  `OPERATOR_ID` / `GAD_OPERATOR_ID`.
- Manifest mutations must be atomic. Use `fs.rename` after writing a
  temp copy; don't overwrite in place.
- Middleware should never silently 200 a request without auth — fail
  loudly so the bug surfaces locally.

## Failure modes

- **`solo-operator` showing up in production logs.** Clerk creds aren't
  set in the deploy. Fail-fast at startup if `NODE_ENV === 'production'`
  and creds are missing.
- **Subagent shell loses operator env.** `start /B` on Windows or `nohup`
  on Linux strips inherited env. Set explicitly via spawn options.
- **`gad publish list` returns stale data.** It reads
  marketplace-index.generated.json — confirm the index is regenerated
  after each publish, not on a build cycle.
- **CLI publish bypasses Clerk auth entirely.** Intentional — CLI runs
  on the server side via the spawn env. The header-based attribution
  is the audit trail, not the auth gate.

## Reference

- Decisions gad-271 (Clerk integration), gad-269 (vendor site = marketing).
- Phase 51 tasks 51-01..51-09.
- Phase 60 task 60-04 (`scoped-spawn.cjs`) for env scoping under spawn.
- `vercel:auth` skill — Clerk-specific Vercel guidance.
