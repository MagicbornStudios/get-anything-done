# Framework R&D: surgical mid-run context removal

**Source:** session 2026-04-17 strategy pivot

Per decision gad-242.

During a long run, redundancy accumulates in the agent's context window — repeated snapshots, re-read files, stale sections the agent has moved past. Current mitigations are passive (auto-compact at thresholds). Goal: active mid-run surgery that removes specific redundant spans without losing current working state.

## Research questions

- Can we detect exact-match or near-duplicate spans cheaply?
- What's the UI/UX — agent asks permission, or autonomous with telemetry?
- How does this interact with prompt cache TTL?
- What signals say "this span is stale"?

## Likely intersection

- sdk/src/context-engine.ts
- Snapshot emitter (post-phase-57)
- Trace v4 schema (tool_use events as span boundaries)
