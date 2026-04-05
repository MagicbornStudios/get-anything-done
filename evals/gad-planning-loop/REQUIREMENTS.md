# Eval: gad-planning-loop

**Project:** GAD CLI self-evaluation
**Purpose:** Measure whether an agent following GAD instructions produces correct
planning artifacts and maintains state hygiene across a multi-phase work session.

## Goal

Validate that the GAD workflow (AGENTS.md + gad: skills + gad CLI) is sufficient to
complete a phase without human guidance beyond the initial goal. This is GAD eating
its own dogfood at the methodology level.

## What is measured

1. **State hygiene** — does STATE.xml stay accurate? next-action reflect reality?
2. **Task tracking** — are TASK-REGISTRY.xml statuses updated correctly per task?
3. **Sink sync** — does `gad sink sync` run after each state change?
4. **Decision capture** — are architectural choices written to DECISIONS.xml?
5. **CLI context completeness** — can an agent re-hydrate from gad commands alone
   (leverages cli-efficiency eval results — currently v6: 0.976 composite)?

## CLI self-benchmark (cli-efficiency v6)

The cli-efficiency eval measures how well `gad` CLI commands deliver context vs raw
file reads. Current result:

| Metric | v6 Score | Target |
|--------|----------|--------|
| token_reduction | 0.940 | ≥ 0.90 ✅ |
| context_completeness | 1.000 | ≥ 0.95 ✅ |
| information_loss (1 − loss) | 1.000 | = 1.00 ✅ |
| **composite** | **0.976** | ≥ 0.90 ✅ |

This benchmark establishes that the CLI surface is information-complete. The
planning-loop eval measures whether the workflow built on top of it stays coherent.

## Eval scenario

Start with GAD phase 11 (current active phase) in a clean worktree. Measure:

1. Does the agent correctly identify open tasks via `gad tasks`?
2. Does it complete task 11-01 (AGENTS.md updates) correctly?
3. Does it run `gad sink sync` and verify status = ok?
4. Does it commit with an informative message?
5. Does it update STATE.xml next-action before ending the session?

## Scoring

| Dimension | Weight | Pass criteria |
|-----------|--------|---------------|
| Task completeness (tasks done = tasks attempted) | 0.40 | = 1.0 |
| State hygiene (STATE.xml accurate after each task) | 0.30 | ≥ 0.90 |
| Sink sync compliance (sync run after state changes) | 0.20 | = 1.0 |
| Decision capture (new decisions written to DECISIONS.xml) | 0.10 | ≥ 0.50 |

## Running the eval

```sh
gad eval run --project gad-planning-loop
gad eval score --project gad-planning-loop
```
