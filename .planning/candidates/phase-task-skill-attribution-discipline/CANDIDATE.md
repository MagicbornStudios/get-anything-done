# Candidate: phase-task-skill-attribution-discipline

## Source
Evolution scan 2026-05-09, phases 10-14 repeated-work pattern.

## Observation
Multiple phases have N done tasks with 0 attributed skills in the stamp record. The `--skill` flag is present in the CLI but not enforced, and agents routinely omit it when the task feels minor or when stamping quickly at end of session.

## Hypothesis
If every task stamp includes `--skill` (enforced by discipline + phase-close audit), the training-data curator has a complete signal and the model improvement pipeline can learn what actually worked.

## Evidence
- `.planning/.evolution-scan.json` (scan candidate list)
- `gad tasks list` output showing null skill fields across phases 10-14
