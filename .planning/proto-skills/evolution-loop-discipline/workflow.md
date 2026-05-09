# Workflow: Evolution Loop Discipline

## Inputs
- Completed milestone OR closed incident response session
- Access to `gad evolution evolve` and `gad evolution status`

## Steps
1. **Trigger**: at the end of any milestone close (`gad complete-milestone`) OR after any incident-response session that produced decisions or ERRORS-AND-ATTEMPTS entries.
2. Run: `gad evolution evolve --projectid <id>`. This scans decisions + errors + task patterns and surfaces candidates.
3. Review the candidate list: `gad evolution status --projectid <id>`. Identify any candidates that are high-confidence (multiple corroborating incidents, clear rule, testable anti-pattern).
4. For each high-confidence candidate: draft the proto-skill bundle (PROVENANCE → workflow → SKILL → CANDIDATE per checkpoint protocol). Use `create-proto-skill` skill.
5. Do NOT promote yet — operator review required per gad-191.
6. Log a state entry: `gad state log "evolution sweep: N candidates → M proto-skills drafted" --projectid <id>`.

## Verification
```sh
gad evolution status --projectid <id>
# Candidates from this sweep should show status: pending_review
# No high-confidence candidates should remain in status: identified (undrafted)
```

## Failure modes
- **Lessons land as decisions but never trigger evolution sweep**: set a milestone-close hook or run manually each session.
- **Evolution runs but no drafts created**: candidates sit in `identified` state forever. High-confidence ones must be drafted same session.
- **Drafting deferred to "next session"**: next session has different context and the lesson is effectively lost. Draft now.
