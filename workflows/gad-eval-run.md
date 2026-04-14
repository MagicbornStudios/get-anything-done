<purpose>
Provide the concrete evaluation procedure behind `gad:eval-run`: generate the bootstrap prompt, run the isolated eval, preserve outputs, verify preservation, reconstruct traces, and review results.
</purpose>

<legacy_methodology>
This workflow preserves the useful policy from the older long-form `eval-run` skill. The key value was not a second skill body — it was the evaluation contract.

Mandatory preservation contract for implementation evals:
- `TRACE.json`
- preserved `run/` output with code and planning docs
- preserved build output
- preserved CLI logs when available
- runtime attribution in telemetry

Mandatory layout contract:
- workflow artifacts live under `game/.planning/`
- source code lives under `game/src/`
- assets live under `game/public/`
</legacy_methodology>

<process>
1. Generate the eval bootstrap prompt and the next versioned run directory.
2. Run the eval in an isolated worktree or equivalent isolated runtime workspace.
3. Preserve outputs before cleanup.
4. Verify preservation.
5. Reconstruct or write trace data.
6. Open the result for human review and record a review score.
7. Compare in reports and findings.
</process>

<rules>
- If preservation is incomplete, the run is invalid.
- Never clean up an eval worktree before preservation is complete.
- The workflow owns reproducibility, not just execution.
</rules>
