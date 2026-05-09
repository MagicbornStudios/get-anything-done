---
status: proto
workflow: ./workflow.md
description: Workers must call completeHandoff themselves — never delegate to the child runtime
triggers:
  - implementing a worker loop
  - reviewing claim-leak issues
  - designing handoff lifecycle
  - handoffs stuck with completed_at null
---

# Worker-Side Complete Handoff

## When to use
Any time you are writing, reviewing, or debugging a worker loop that dispatches work to a child runtime (codex, gemini, opencode, subagent). The worker — not the child — is responsible for calling `completeHandoff` on success.

## Why this matters
Child runtimes run inside sandboxes that block outbound API calls by policy. Codex is the documented case (GLOBAL-D-330), but the pattern applies broadly: any child runtime may lack network egress, credentials, or the `gad` binary. Today's incident: 66 of 264 closed handoffs had `completed_at: null` because workers delegated completion to codex children that silently dropped the call. The data integrity of the handoff lifecycle depends on workers owning their own bookkeeping.

## Triggers
- "implementing a worker loop"
- "building handoff lifecycle"
- "handoffs show completed_at null"
- "claim leak review"
- "worker is dispatching to codex/gemini/opencode"

## Success criteria
- Every handoff closed by a worker shows non-null `completed_at`
- Worker code has explicit `completeHandoff` call after child exits, not inside the child prompt
- Code review: no handoff ID passed to child runtime with expectation it calls complete

## Anti-patterns
- Passing handoff ID into child prompt and trusting it to call `gad handoffs complete`
- Worker loop exits without awaiting confirmation of completion
- Using child exit code as a proxy for completion without explicit complete call

## See also
- GLOBAL-D-330
- `.planning/ERRORS-AND-ATTEMPTS.xml` (sandbox-blocked completion entries)
