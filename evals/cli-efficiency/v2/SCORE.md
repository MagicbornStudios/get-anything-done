# Score v2 — cli-efficiency

**Scoring weights** (from gad.json): token_reduction 0.40, context_completeness 0.35, information_loss 0.25

## Component scores

| Metric | v1 | v2 | Target | Status |
|--------|----|----|--------|--------|
| token_reduction | 0.966 | 0.953 | ≥ 0.90 | ✅ |
| context_completeness | 0.55 | 0.95 | ≥ 0.95 | ✅ |
| information_loss (1 - loss_rate) | 0.00 | 0.90 | = 1.00 | ⚠️ |

## Composite score

| Version | Calculation | Score |
|---------|-------------|-------|
| v1 | (0.966×0.40) + (0.55×0.35) + (0.00×0.25) | **0.579** |
| v2 | (0.953×0.40) + (0.95×0.35) + (0.90×0.25) | **0.884** |

## Delta: +0.305 (+52.7% improvement)

## What moved the score
- **context_completeness: +0.40** — task-registry-reader now covers TASK-REGISTRY.xml; open_tasks cross-referenced; next-action surfaced; phase done/active status fixed
- **information_loss: +0.90** — in-progress tasks, session state, phase correctness all now present
- **token_reduction: -0.013** — minor decrease because `gad state` output grew (richer data); still well above target

## Outstanding gap
- `last_activity` returns a string description ("N tasks done in phase X") not an ISO date. Fix: populate `updated` attribute in STATE.xml on each session write. Estimated impact: +0.04 on composite.
