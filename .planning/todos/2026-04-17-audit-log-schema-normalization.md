# Normalize audit-log schema — legacy {ts,event} rows vs new lifecycle rows coexist

**Source:** 2026-04-17 S16 — 60-05 lifecycle follow-up #3

.gad/secrets/<projectid>.audit.jsonl currently holds two row shapes:

  Legacy (written by secrets-store.cjs rotate internals from 60-02):
    {"ts":"2026-04-17T...","event":"envrotate","keyName":"X","oldVersion":1,"newVersion":2}

  New (written by secrets-lifecycle.cjs from 60-05):
    {"eventId":"<uuid>","eventType":"rotate","projectId":"...","keyName":"X","ts":"...","actor":"cli","details":{...}}

The lifecycle layer reads both cleanly (tolerant JSONL parser) but UI code that renders the audit log (future: project-editor BYOK tab + landing BYOK surface) will need to special-case.

Fix path: migrate legacy rows to the new shape on next lifecycle write. Add a one-shot migration pass: on first lifecycle.rotate/revoke/purge call for a project with legacy rows present, rewrite the audit file with all rows normalized to the new schema. Idempotent — checks a schemaVersion marker at the top of the file. Append-only invariant preserved (write to tmp, rename).

Alternative: don't migrate, just teach all readers to accept both shapes forever. Costs: every new consumer (UI, API, analytics) must know the dual-shape. Cheaper one-time-migration wins long-term.

Blocks: project-editor BYOK tab (60-07) and landing BYOK surface (60-08) audit-log rendering. Schedule before 60-07 starts.
