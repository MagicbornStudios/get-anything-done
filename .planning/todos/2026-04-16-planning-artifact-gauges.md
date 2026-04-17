# Planning-artifact gauges on editors

**Date captured**: 2026-04-16
**Decisions**: gad-226
**Related**: gad-227 (visibility), gad-220/222 (pressure formula), roadmap-artifact-question-2026-04-16.md

## The idea

Replace the "raw XML viewer" default in the Project / Species / Generation
editor panes with a gauge bank — one gauge per planning artifact type.

Four confirmed gauges (roadmap pending the open question):

- **Decisions gauge** — direction. Display: count + D/T ratio. Sweet spot
  band: 1 decision per 10-20 tasks. Low = drifting. High-and-low-tasks =
  overthinking.
- **Tasks gauge** — implementation detail. Display: total + done/open split.
- **Requirements gauge** — what-to-build. Display: requirement count + kind
  breakdown. Low = vague spec risk.
- **Notes gauge** — open-question breadth. Display: count + mtime histogram
  (lots of stale notes vs recent notes = different signals).

## Scope

- `project` editor: project-level aggregate gauges across all species.
- `species` editor: species-scoped gauges (inherits project requirements +
  decisions per gad-184, plus species-only content).
- `generation` editor: generation-scoped gauges (narrower — mostly runtime
  notes + scoring).

## Implementation sketch

1. `site/components/gauges/PlanningGauge.tsx` — one generic component that
   takes `{ artifact, count, sweetSpotBand, imbalanceWarning }`.
2. `site/components/gauges/PlanningGaugeBank.tsx` — 4-gauge (or 5-gauge,
   pending) row, drops into any editor pane.
3. Sweet-spot thresholds in `site/data/gauge-config.json`, per-scope
   (project/species/generation).
4. Data source: reuse the 45-02 `project-planning-data.ts` adapter; extend
   with species- and generation-scoped variants when those editors exist.
5. The pressure formula (gad-220, gad-222) already computes D/T and crosscut
   metrics — gauges import the same `compute-self-eval.mjs` output so there
   is one source of truth for "how dense is the work."

## Dependencies

- 45-02 adapter (done) — feeds project-level data.
- 44.5 editor shell — gauge bank lands on editor panes.
- Roadmap question — resolve before adding a fifth gauge.

## Not in scope

- Gauge animation / polish. Static bar-and-badge is fine for v1.
- Historical gauge trends. First cut is a point-in-time snapshot; timeline
  comes later.
