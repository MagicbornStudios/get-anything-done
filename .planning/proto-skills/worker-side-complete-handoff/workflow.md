# Workflow: Worker-Side Complete Handoff

## Inputs
- Handoff ID being worked
- Worker loop implementation (or code under review)
- Access to `gad handoffs complete` or equivalent API call

## Steps
1. Before dispatching to child runtime: confirm the worker loop — not the child — owns the `completeHandoff` call path.
2. After child runtime finishes (success OR controlled failure), worker calls `gad handoffs complete --id <handoff-id> --projectid <id>` immediately.
3. Do NOT pass the handoff ID into the child runtime prompt expecting it to call complete. Child runtimes (especially codex) run in sandboxes that block outbound API calls.
4. If child exits with non-zero: worker calls `gad handoffs unclaim --id <handoff-id>` and logs the failure reason to `unclaim_history`.
5. Verify: `gad handoffs show <id>` must show `completed_at` non-null and `status: closed`.

## Verification
```sh
gad handoffs show <id> --projectid <id>
# completed_at must be non-null
# status must be "closed"
```

Check aggregate: `gad handoffs list --status claimed --projectid <id>` — any with `completed_at: null` older than 30 min are orphans from this bug.

## Failure modes
- **Symptom**: `completed_at: null` on closed handoffs. Cause: child was given responsibility it cannot fulfill.
- **Recovery**: Worker calls complete retroactively; sweep with `gad handoffs sweep --projectid <id>` if supported.
- **Trap**: Worker exits before confirming completion. Always `await` the complete call before worker loop iteration ends.
