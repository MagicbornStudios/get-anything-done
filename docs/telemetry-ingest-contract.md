# Telemetry ingest contract — GAD ↔ slm-learning

Phase 145 (slm-training-data-collection-v1) task GLOBAL-T-145-07.

This is the contract between the GAD monorepo (producer) and the
sibling `slm-learning` project (consumer). Both sides ship code that
honours the manifest format below; if either side breaks the schema
without bumping `schema_v`, the other side's ingest fails closed
rather than ingesting silently-corrupted training data.

## Producer side (GAD monorepo)

Command:

```sh
gad telemetry export \
  --to ../slm_learning/data/raw/<YYYY-MM-DD>/ \
  --since <ISO-8601> \
  --format jsonl \
  --root-dir <monorepo-root>
```

Output layout under `<to>`:

```
data/raw/<YYYY-MM-DD>/
├── events.jsonl       # one envelope per line
└── MANIFEST.json      # schema_v + sha256 + counts
```

`events.jsonl` envelope shape (see
`vendor/get-anything-done/lib/telemetry/envelope.cjs` for canonical
validator):

```json
{
  "id":         "<deterministic uuid v4-shaped, derived from source key>",
  "ts":         "2026-05-06T09:30:00.123Z",
  "run_id":     "cc-<sid>-<ts>  | cx-<sid>-<ts> | gm-... | oc-... | gd-... | wk-w1-...",
  "project":    "global | get-anything-done | slm-learning | ...",
  "task_id":    "GLOBAL-T-145-01 | null",
  "handoff_id": "h-2026-05-05T05-11-43-global-92 | null",
  "runtime":    "claude-code | codex-cli | gemini-cli | opencode | gad-cli",
  "model":      "claude-opus-4-7 | gpt-5.4 | gemini-2.5-pro | ... | null",
  "role":       "prompt | reasoning | tool_call | tool_result | response | meta",
  "content":    { "text": "...", "...source-specific keys...": "..." },
  "parent_id":  "<envelope.id of related call> | null",
  "seq":        42,
  "agent_id":   "team-w1 | claude-code-global | subagent-... | null",
  "schema_v":   1
}
```

`MANIFEST.json` shape:

```json
{
  "schema_v":     1,
  "exported_at":  "2026-05-06T09:55:00.000Z",
  "since":        "2026-05-01T00:00:00Z",
  "until":        "2026-05-06T09:55:00.000Z",
  "data_file":    "events.jsonl",
  "data_sha256":  "3856a205dcf6be46bd04dd6d9790d7d81ab5504ead377a87ea90dc467e644f37",
  "data_bytes":   83419321,
  "row_count":    119819,
  "role_histogram": {
    "meta":       60607,
    "tool_call":  919,
    "tool_result":919,
    "reasoning":  52717,
    "response":   3497,
    "prompt":     1160
  },
  "source_commits": {
    "monorepo":   "<git sha at export time>",
    "gad":        "<submodule sha at export time>"
  }
}
```

## Consumer side (slm-learning)

Pull the latest day's snapshot:

```python
# scripts/ingest_gad_telemetry.py (handoff workstream A in
# .planning/handoffs/open/h-2026-05-06T09-30-00-slm-learning-bridge.md)
import json, hashlib, pathlib

day = pathlib.Path("data/raw/2026-05-06")
manifest = json.loads((day / "MANIFEST.json").read_text())

assert manifest["schema_v"] == 1, f"schema_v mismatch: {manifest['schema_v']} != 1"

data_file = day / manifest["data_file"]
sha = hashlib.sha256(data_file.read_bytes()).hexdigest()
assert sha == manifest["data_sha256"], "sha256 mismatch — corrupt or tampered"

# Stream-process; events.jsonl can be 100MB+
with data_file.open("r", encoding="utf-8") as fh:
    for line in fh:
        env = json.loads(line)
        # Train shape:
        #   prompt + response → SFT (single-turn)
        #   reasoning → reasoning-corpus (Stage 2 in slm-learning)
        #   tool_call + tool_result → tool-use SFT
        #   meta → metadata only, not training material
        ...
```

## Schema versioning rules

- `schema_v=1` is current. Bumps are MAJOR — `1` and `2` are not
  cross-compatible.
- Producer must NOT change envelope field semantics under the same
  `schema_v`. Adding NEW optional fields is allowed (consumer must
  ignore unknown fields).
- Producer must NOT add new role values under the same `schema_v`.
  Adding new roles requires a bump (consumer's role-handler is a
  fixed set).
- Removing a field, changing a role meaning, changing primary key
  derivation: ALWAYS a `schema_v` bump.

## Idempotency / replay

- `id` is deterministic per source row (sha1 of stable key truncated
  to uuid shape). Same source → same id every time.
- Re-export with overlapping `--since` is safe; consumer dedupes by
  `id`.
- No source row is dropped silently — invalid rows are logged to
  stderr but the run still emits the rest. Consumer can scan for
  stderr `[telemetry export]` warnings if integrity matters.

## Retention

- Producer-side: raw `.gad-log/`, `.trace-events.jsonl`, worker logs
  retained indefinitely (gitignored, local disk only).
- Exported snapshots: kept in `slm_learning/data/raw/<date>/` per day.
  Suggested rotation: keep last 30 days raw, archive older to
  `data/archive/<YYYY-MM>/` as `.tar.gz`.
- Manifests are immutable post-write — never edit.

## Discovered today (2026-05-06 first real export)

- 119,819 envelopes from 4 sources covering ~1 month of activity
- Distribution skews heavily toward `meta` (60K) and `reasoning`
  (52K). `response` is small (3.5K) because Claude assistant text
  isn't captured until the Stop hook (T-145-04) is INSTALLED into
  Claude settings.json. Run `gad install hooks` to wire it.
- `prompt` is tiny (1.1K) because non-Claude runtime prompts come
  exclusively from worker dispatches; one-off `gad runtime launch`
  invocations don't write `.prompt.md` files. v2 follow-up: capture
  one-shot prompts.

## Known limitations

- PII redaction is OUT-OF-SCOPE for v1. Manifest carries no scrubbing
  flag. Consumers must assume secrets MAY appear in `prompt` content
  (operator API keys captured in worker prompts) and handle
  accordingly.
- `model` field is sometimes null on `worker-log` envelopes pre-first
  stderr banner. Filter on `model IS NOT NULL` for runtime-attribution
  studies.
- `outputs_truncated=true` rows in `trace-events` source — content is
  pre-truncated by `lib/trace-truncate.cjs`. Cap is currently 1000
  events per session. Document via T-145-08 risk #3.

## Related artifacts

- Phase plan: `.planning/phases/145-slm-training-data-collection-v1/PLAN.md`
- Phase 146 (SWE benchmarks): consumes envelope shape, adds `role=benchmark_run` and `role=benchmark_task` (schema_v=1 backward-compatible — uses existing `meta` role with `kind` discriminator)
- Phase 147 (continuous delta-training): runs the daemon that consumes ingest output → fine-tunes → benchmarks → promotes
- Cross-instance bridge handoff: `<slm-learning>/.planning/handoffs/open/h-2026-05-06T09-30-00-slm-learning-bridge.md`

## Versioning of this contract

| schema_v | Date | Producer commit | Notes |
|---|---|---|---|
| 1 | 2026-05-06 | gad@9a8e6acd | Initial. 6 roles, 12 envelope fields. |
