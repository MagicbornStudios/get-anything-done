<purpose>
Provide the concrete debugging procedure behind `gad:debug`: gather symptoms, form hypotheses, test them cheaply, confirm root cause, and either fix or hand off with durable state.
</purpose>

<legacy_methodology>
This workflow preserves the useful methodology from the older long-form `debug` skill while letting the `gad:debug` skill remain the command/orchestrator surface.

Core loop:
- gather symptoms
- write or resume a debug session file
- form 3-5 concrete hypotheses
- test the cheapest/highest-likelihood hypothesis first
- eliminate or confirm
- stop when root cause is confirmed

Minimum debug artifact:
- `.planning/debug/<slug>.md`
- symptoms
- hypotheses
- investigation log
- root cause
- next action or resolution
</legacy_methodology>

<process>
1. Check for an active debug session for the issue. Resume if present.
2. Gather expected behavior, actual behavior, reproduction, timing, and prior attempts.
3. Create or update a debug session file under `.planning/debug/`.
4. Form a ranked hypothesis list with explicit tests.
5. Test hypotheses in order, recording eliminations and confirmations.
6. Once root cause is confirmed:
   - fix now, or
   - create a follow-up task, or
   - hand off with a clear diagnosis
7. If fixed, verify the symptom is resolved and mark the session resolved.
</process>

<rules>
- Do not jump straight to a fix without a confirmed cause.
- Do not let a debug session live only in chat context.
- If three hypotheses are eliminated with no root cause, widen the scope and record the dead end.
</rules>
