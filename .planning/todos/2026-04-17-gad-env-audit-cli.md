# Wire gad env audit CLI + auto-purge on active project at startup

**Source:** 2026-04-17 S16 — 60-05 lifecycle follow-up #1

lib/secrets-lifecycle.cjs (task 60-05) exposes createSecretsLifecycle with {rotate, revoke, purgeExpired, auditLog}. Only rotate + revoke are wired into the CLI today (via lib/env-cli.cjs from 60-03 which calls store.rotate/revoke directly and does NOT go through the lifecycle layer).

Missing CLI wiring:

1. 'gad env audit --projectid <id>' — stream the audit log in human format. Flags: --since, --limit, --json. Read via lifecycle.auditLog().
2. Route 'gad env rotate' and 'gad env revoke' through the lifecycle layer instead of calling store directly, so every rotate/revoke produces an audit event. Backward-compat: legacy rows in the audit log (shape {ts,event:'envrotate'} from store-level writes) must still read cleanly — lifecycle.auditLog() already tolerates this.
3. Auto-purge on active-project CLI startup. On any 'gad env *' or 'gad snapshot' or 'gad startup' call, run lifecycle.purgeExpired({projectId}) silently. Grace-period-expired versions auto-disappear. Fail-closed: purge errors log but do not block the user's command.

Size: small-medium. Depends on: 60-05 done (✓), scoped-spawn 60-04 done (✓).

Can go in phase 60 as 60-05a, or fold into 60-07 editor BYOK tab when that lands. Recommend its own task right after 60-06 migration lands so llm-from-scratch has full lifecycle visibility.
