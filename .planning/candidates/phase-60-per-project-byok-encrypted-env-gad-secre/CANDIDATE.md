---
status: candidate
source_phase: "60"
source_phase_title: "Per-project BYOK encrypted env — .gad/secrets store, CLI, scoped spawn, UI surfaces"
pressure_score: 48.54
tasks_total: 13
tasks_done: 13
crosscuts: 7
created_on: "2026-04-23"
created_by: compute-self-eval
---

# Candidate from phase 60

## Phase

```
get-anything-done | 60 | Per-project BYOK encrypted env — .gad/secrets store, CLI, scoped spawn, UI surfaces
selection pressure: 48.54  (13 tasks, 13 done, 7 crosscuts)
```

## Tasks

```
60-01 done Write references/byok-design.md resolving the open questions in phase 60 goal + decision gad-260: (a) crypto primitive — libsodium sealed-box vs AES-256-GCM with scrypt KDF, recommend one, (b) master-key UX — OS keychain-first (Windows Credential Manager, macOS Keychain, Linux secret-service) with passphrase fallback when keychain unavailable, (c) on-disk format — JSON envelope with version, salt, nonce, per-key metadata (last-rotated, scope, provider), (d) rotation model — in-place vs additive, (e) site-side strategy — browser-only WebCrypto decrypt vs server-side per-user KMS.
60-02 done Implement lib/secrets-store.cjs + OS-keychain wrappers. .gad/secrets/&lt;projectid&gt;.enc format from 60-01. Three keychain adapters: windows-credential-manager (via PowerShell or node-ffi), macos-keychain (security CLI), linux-secret-service (via dbus-next). Unit tests with a mock keychain adapter. .gad/ added to repo-level .gitignore across all projects that register a planning root.
60-03 done CLI family: 'gad env get &lt;KEY&gt; --projectid', 'gad env set &lt;KEY&gt; --projectid' (reads value from prompt, not argv, to avoid shell history), 'gad env list --projectid' (keys + metadata, never values), 'gad env rotate &lt;KEY&gt; --projectid', 'gad env revoke &lt;KEY&gt; --projectid'. All operations require master-key unlock.
60-04 done Scoped spawn wrapper in lib/scoped-spawn.cjs. Given projectId + child command, decrypts that project's env bag, merges into child process.env ONLY for the child, never mutates parent process.env. Subagent dispatch (phase 59 task 59-07) uses this wrapper. Subagent sees OPENAI_API_KEY etc. without the main session leaking it.
60-05 done Key lifecycle UX: rotation flow (generate new, re-encrypt, zero-out old buffer), revocation flow (remove from bag + record revocation event in audit log), audit log at .gad/secrets/&lt;projectid&gt;.audit.jsonl (append-only, gitignored).
60-05a done CLI wiring for the lib/secrets-lifecycle.cjs layer delivered in 60-05. Two new subcommands: `gad env audit &lt;projectid&gt; [--since ISO] [--limit N] [--json]` (newest-first audit-log view, wraps secretsLifecycle.auditLog) and `gad env purge &lt;projectid&gt; [--as-of ISO] [--dry-run] [--json]` (manual grace-period purge, wraps secretsLifecycle.purgeExpired). Plus a best-effort auto-purge preflight in `gad start` — scans all projects with an existing .gad/secrets/&lt;id&gt;.enc envelope, calls purgeExpired on each, logs one-line summary to stderr, NEVER fails start on purge error (swallow + log). Library extension in lib/env-cli.cjs adds auditCmd + purgeCmd following the same dep-injection + guarded error pattern. Tests in tests/env-cli.test.cjs (audit + purge describe blocks) with lifecycle mocks matching the existing store-mock shape.
60-06 done Migrate llm-from-scratch OPENAI_API_KEY from global process.env into its project bag. Subagent wrapper for llm-from-scratch uses scoped-spawn + 'gad env get' to decrypt at dispatch time. Documents the expected migration in references/byok-design.md §Migration.
60-07 done Project-editor BYOK tab UI. Lives in local-dev project-editor (phase 44.5). Tab renders current keys (redacted — last 4 chars only), 'add key' form with paste + provider picker + 'test call' validation button, rotate/revoke actions. Calls 'gad env' CLI via dev-server command bridge. Local-dev only — NODE_ENV=development gate. Shipped 2026-04-18: added 4th left-pane tab (BYOK) to ProjectEditor.tsx + new ByokTab.tsx component. Backend uses dedicated /api/dev/secrets/[projectId] route (GET list/POST set/PUT rotate/DELETE revoke) + /audit + /test sub-routes that import lib/secrets-store.cjs directly via createRequire — bypasses the SSE command-bridge for mutating ops to avoid stdin-pipe plaintext exposure. Also added 'env' to command-bridge ALLOWED_SUBCOMMANDS for any future read-only CLI calls. Provider validators: openai, anthropic, openrouter, groq (HTTP probe with 8s timeout). Last-four redaction via decryptAll() with synchronous plaintext drop. Audit tail surfaces last 20 envset/envrotate/envrevoke/envpurge events. Built clean against next 16.0.8 turbopack. Unblocks 60-08 (cloud BYOK surface, same shapes behind auth).
60-07b done Scoped BYOK + non-secret env defaults + dev-server passphrase fix. Per decision gad-268, extend the BYOK surface so keys and env defaults resolve along a scope chain: species &gt; eval &gt; planning. Shipped 2026-04-18: (1) lib/secrets-store.cjs — scope arg threaded through get/set/list/rotate/revoke/decryptAll; envelope+audit paths nest under .gad/secrets/&lt;projectId&gt;/&lt;scope-path&gt;.enc; per-scope keychain account (projectId::scope) so each scope&apos;s master key is independent; new listChain/decryptChain walk most-specific→least, marking shadowed parents in shadows[]. Backward-compatible: no-scope = legacy planning bag at .gad/secrets/&lt;projectId&gt;.enc. (2) tests/secrets-store.test.cjs — added scope path resolution + per-scope isolation suites (29 tests pass total). (3) lib/env-defaults-store.cjs — new plain-JSON scoped store at .gad/env/&lt;projectId&gt;[/&lt;scope&gt;].json with CRUD, parent-merge resolveChain, path-traversal safety, auto-gitignore on first write. (4) tests/env-defaults-store.test.cjs — 12 tests round-trip + scope merge + validation + gitignore. (5) lib/env-cli.cjs — --scope/--scope-chain flags on list/get/set/rotate/revoke; renderListTable adds BAG + SHADOWS columns when present; fixed revokeCmd variable shadow that was dropping --scope on the way to store.revoke. (6) lib/keychain/passphrase-fallback.cjs — honor GAD_NO_TTY_PROMPT=1 to refuse interactive prompts in server contexts (Next.js dev server inherits parent TTY → would deadlock HTTP request). (7) lib/secrets-store-errors.cjs — added VALIDATION code shared with env-defaults-store. (8) New API routes /api/dev/env-defaults/[projectId] (list/set/unset, scope+chain) + /api/dev/scopes/[projectId] (walks evals/&lt;eval&gt;/species/&lt;species&gt; for picker source); /api/dev/secrets/[projectId] + /audit + /test now accept scope/scopeChain/scopeBag and decrypt-once per distinct bag for last-four tails. All routes set process.env.GAD_NO_TTY_PROMPT=&quot;1&quot; at module load. (9) ByokTab.tsx — ScopePicker dropdown, BagBadge (active vs inherited), ShadowHint (count of parents hidden), inherited rows go read-only (rotate/revoke disabled), AddKeyForm + RotateForm + TestCallButton thread scopeBag end-to-end, new EnvDefaultsSection mirrors the keys list for non-secret values, AuditList title shows active scope, byokFetch wrapper handles PASSPHRASE_REQUIRED_NO_TTY (423) + PASSPHRASE_INVALID (401) by prompting via window.prompt and caching in tab-lifetime Map. 108/108 BYOK-related tests pass. Note: re-applied after parallel-agent vendor commits clobbered the lib + planning edits — see commit message.
60-08 done Landing-site project-dashboard BYOK surface. Lands on planning-app post phase 59 split. Auth-gated. Same key-management surface as 60-07 + scope chain from 60-07b but for cloud projects. Decryption strategy per 60-01 decision — browser WebCrypto or server-side KMS. Keys never transit plaintext over the wire in either direction.
60-09 done Work-stealing handoff queue using per-file directory (not JSONL — decision per user 2026-04-18, see .planning/notes/2026-04-18-handoff-queue-design.md). Shape: .planning/handoffs/{open,claimed,closed}/ with one md file per handoff. Lifecycle = fs.rename between dirs (atomic on POSIX + Windows, no lock needed). Each file = YAML frontmatter {id, projectid, phase, task_id, created_at, created_by, claimed_by, claimed_at, completed_at, priority, estimated_context} + markdown body. CLI: gad handoffs {list,claim,complete,show,create}. gad-pause-work + gad-session pause invoke &apos;handoffs create&apos;. gad startup/snapshot surface unclaimed count + top-3 summary. Idle agents pick appropriate items by estimated_context (mechanical→Haiku/Sonnet, reasoning→Opus per offload policy). Gap discovered: no &apos;gad tasks update &lt;id&gt; --goal&apos; exists — surfaced in design note, file as follow-up. See .planning/notes/2026-04-18-handoff-queue-design.md for full schema.
60-10 done Split secrets-store error codes: PROJECT_NOT_FOUND for missing envelope on disk vs KEY_NOT_FOUND for envelope-exists-but-key-absent. Removes the substring-match antipattern in scoped-spawn.cjs (isMissingEnvelope) and env-cli.cjs list-empty soft-swallow. Files touched: lib/secrets-store.cjs (1 throw site), lib/scoped-spawn.cjs (isMissingEnvelope), lib/env-cli.cjs (messageFor + list catch), references/byok-design.md (sec.12 error table), tests/secrets-store.test.cjs (split test), tests/scoped-spawn.test.cjs (mock helper), tests/env-cli.test.cjs (list-empty + messageFor table). Closes todo 2026-04-17-secrets-store-project-not-found-split. Unblocks BYOK UI rendering in 60-07/60-08.
60-09b done Read-only handoff queue dashboard in planning-app (/handoffs). Walks vendor/.planning/handoffs/{open,claimed,closed}/, parses YAML frontmatter, renders bucket sections with priority and estimated_context chips. Auth-gated. Highlights operator&apos;s own claims. Writes still flow through gad handoffs CLI until per-file format stabilizes. Adds /handoffs to AppShell + middleware.
```

## What this candidate is for

This file was auto-generated by `compute-self-eval.mjs` because phase
60 exceeded the selection pressure threshold. High pressure
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

The drafter writes to `.planning/proto-skills/phase-60-per-project-byok-encrypted-env-gad-secre/SKILL.md` — a
**different directory** from this candidate. Candidates and proto-skills
are two distinct stages:

- **candidate** (this file) = raw selection-pressure output
- **proto-skill** (drafter output) = drafted SKILL.md awaiting human review
- **skill** (post-promote) = lives in `skills/` as part of species DNA

The human reviewer runs `gad evolution promote <slug>` or
`gad evolution discard <slug>` after reviewing the proto-skill.
