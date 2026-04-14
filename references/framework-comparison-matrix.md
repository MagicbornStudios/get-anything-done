# Framework Comparison Matrix

This file defines the canonical framework conditions for official GAD evals.

## Canonical target

The default comparison project is `escape-the-dungeon`.

Reasons:
- it already anchors the lineage of greenfield and brownfield eval history
- it has human-review context and gate history across multiple rounds
- it is rich enough to expose framework tradeoffs instead of only setup speed

If another project becomes an official target later, add it as an explicit second canonical target. Do not silently replace Escape the Dungeon.

## Canonical conditions

### `bare`

Minimal project scaffold. No framework content is injected beyond the eval's own project files and task prompt.

Use this as the no-framework control.

### `GSD`

Upstream `get-shit-done` condition.

Use this to measure the current upstream framework directly, not a remembered or partially ported version.

### `GAD`

Current `get-anything-done` framework condition.

This includes GAD's baseline content, skills, agents, references, and its own evolution-aware methodology. GAD is already content-driven and emergent in one track.

### `emergent`

Starts from a bare project and accumulates agent-authored skills or workflow content over generations.

This is distinct from GAD because the emergent condition begins without a preinstalled framework baseline.

### `custom`

Any condition that adds extra skills, content, agents, or workflow DNA beyond its canonical baseline.

Examples:
- `bare` plus installed skills
- `GSD` plus extra local skills or custom content
- `GAD` plus extra project-specific or inherited skills beyond baseline GAD
- `emergent` plus manually installed framework content

If you have to ask whether a run is still canonical, it is probably `custom`.

## Classification rules

1. A run stays canonical only when it uses the unmodified baseline for that condition.
2. Installing extra skills or content moves the run to `custom`.
3. `GAD+emergent` is not a separate canonical bucket. If GAD receives extra injected skill/content beyond baseline GAD, classify it as `custom`.
4. `emergent` must begin from a bare project baseline. If it begins from GAD or GSD, it is not the canonical emergent condition.
5. Comparison reports should always state both:
   - the condition label
   - the exact baseline source used

## Reporting contract

Every official comparison should expose:
- project target
- condition
- baseline source or commit
- extra installed content, if any
- whether the run is canonical or `custom`

Do not publish a single aggregate chart that mixes canonical and custom runs without labeling them.

## Why this exists

The matrix is meant to answer framework questions cleanly:
- how does no framework compare to a structured framework?
- how does upstream GSD compare to current GAD?
- does emergent skill accumulation help when starting from bare?
- what happens once humans or agents start composing extra behavior beyond the baseline?

Without a stable matrix, every run turns into its own bespoke species and the comparison stops meaning anything.
