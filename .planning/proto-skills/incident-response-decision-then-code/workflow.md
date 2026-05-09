# Workflow: Incident Response Decision-Then-Code

## Inputs
- Active incident with identified root cause
- Access to `gad decisions add` and `gad errors add`

## Steps
1. **Stop coding.** Identify the root cause before touching any files.
2. **Log the decision**: `gad decisions add "<rule derived from root cause>" --projectid <id> --phase <n>`. Decision body = the permanent rule future agents follow. This is the durable record.
3. **Log the error** (if implementation mistake contributed): `gad errors add "<summary>" --context "<what happened>" --failure "<what went wrong>" --rule "<the rule>" --projectid <id>`.
4. **Now implement the fix.** The decision is the spec; the code implements it.
5. **Test** the fix against the failure mode described in the decision.
6. **Write postmortem** as a state log entry: `gad state log "incident: <name> — root cause + fix summary" --projectid <id>`.
7. **Trigger evolution sweep**: `gad evolution evolve --projectid <id>` to surface these decisions as proto-skill candidates.

## Verification
- Decision record exists with the rule stated as a forward-looking constraint
- Error record exists (if applicable) with the rule field populated
- Code fix references the decision ID in the commit message
- State log has the postmortem entry

## Failure modes
- **Code first, decision later**: the decision becomes a post-hoc rationalization, not a spec. Future agents see the code but not the reasoning.
- **Commit message as substitute for decision**: commit messages are not searchable by `gad decisions list`; agents can't query them.
- **Decision without error record**: the failure mode isn't captured; next agent repeats the same path.
- **Skipping evolution sweep**: the lesson stays in decisions/errors but never becomes a skill.
