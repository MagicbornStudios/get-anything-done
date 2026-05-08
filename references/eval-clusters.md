# Eval Clusters — Orthogonality Audit & Cluster-Based Eval Matrix

**Status:** Active. Computed 2026-05-08 from 211 closed+claimed handoffs.
**CLI:** `gad eval clusters scan | list | enumerate`
**Library:** `lib/orthogonality/index.cjs`

---

## Why cluster-driven over combinatorial

Handoffs are parameterised on four dimensions:

| Dimension | Known values |
|---|---|
| `estimated_context` | mechanical, prescribed, bounded, exploratory, reasoning, design, audit, feature, light, normal |
| `risk` | safe, destructive, irreversible, medium |
| `time` | quick, standard, medium, deep, short, large |
| `surface` | local, cross-project, api-bound |

Full combinatorial coverage = 10 × 4 × 6 × 3 = **720 theoretical combos**.
Most are impossible, nonsensical, or vanishingly rare in production.

Running an eval matrix against all 720 would:
- Waste 99% of compute on combos that never occur in the field
- Obscure signal from high-frequency combos under noise from synthetic edge cases
- Produce scores on configurations no real agent will ever execute

Cluster-driven eval uses **production frequency** to collapse the space:
production data from 211 handoffs across 22 observed combos → **6 natural clusters** → one representative config per cluster → **6-10 high-signal test configurations** instead of 720.

---

## Audit method

1. Scan `.planning/handoffs/closed/` and `.planning/handoffs/claimed/` across all known planning roots (monorepo + submodule + sibling projects).
2. Extract frontmatter: `estimated_context`, `risk`, `time`, `surface`.
3. Build frequency table: count occurrences of each (context, risk, time, surface) 4-tuple.
4. Greedy Hamming-distance clustering:
   - Seeds = combos with count ≥ `minFreq` (default 2), taken in frequency order.
   - A new combo merges into nearest seed if Hamming distance ≤ `maxDist` (default 1) AND both have ≥ 2 known shared dimensions.
   - If no seed is close enough and cluster count < `maxClusters`, start new cluster.
   - Remaining low-freq combos merge into nearest cluster or are discarded as noise.
5. Each cluster gets a semantic label via `LABEL_RULES` heuristics; falls back to `cluster-N`.

**Partial-schema records** (handoffs without risk/time/surface — schema v1, pre-2026-04) are treated separately: they cluster on `context` alone and are labelled `reasoning-std`, `mechanical-fix`, etc. They do NOT absorb fully-specified combos.

---

## Default cluster taxonomy (from live audit, 2026-05-08, n=211)

| Cluster ID | context | risk | time | surface | Handoffs | Description |
|---|---|---|---|---|---|---|
| `reasoning-std` | reasoning | (v1) | (v1) | (v1) | 73 | Open-ended problem-solving; typical AI engineering task |
| `bounded-impl` | bounded | safe | standard | local | 68 | Bounded implementation: clear scope, safe changes, standard time |
| `mechanical-fix` | mechanical | (v1) | (v1) | (v1) | 44 | Pure execution of a spec; no architectural judgment needed |
| `design-deep` | design | safe | deep | local | 14 | Architecture/design/aesthetic work; quality over speed |
| `feature-impl` | feature | safe | medium | local | 6 | Feature delivery within a medium time horizon |
| `light-task` | light | (v1) | (v1) | (v1) | 2 | Minimal-scope task; quick lookup or config tweak |

(v1) = handoff predates the risk/time/surface schema; those dims are unknown.

**Recommended eval matrix seeds:**

```json
[
  { "id": "reasoning-std",   "context": "reasoning",   "risk": "safe", "time": "standard", "surface": "local" },
  { "id": "bounded-impl",    "context": "bounded",     "risk": "safe", "time": "standard", "surface": "local" },
  { "id": "mechanical-fix",  "context": "mechanical",  "risk": "safe", "time": "standard", "surface": "local" },
  { "id": "design-deep",     "context": "design",      "risk": "safe", "time": "deep",     "surface": "local" },
  { "id": "feature-impl",    "context": "feature",     "risk": "safe", "time": "medium",   "surface": "local" },
  { "id": "light-task",      "context": "light",       "risk": "safe", "time": "quick",    "surface": "local" }
]
```

Fill in `safe/standard/local` for any unknown dims when running matrix configs — those are the production defaults (>95% of fully-specified handoffs).

---

## Dimension defaults (from audit)

| Dimension | Dominant value | Production % |
|---|---|---|
| `risk` | `safe` | ~98% |
| `surface` | `local` | ~96% |
| `time` | `standard` | ~74% |
| `context` | `reasoning` / `bounded` / `mechanical` | top 3 cover ~73% |

---

## How `gad eval clusters` is used by the eval pipeline

### Scan (run periodically or before an eval suite)

```sh
gad eval clusters scan [--projectid global] [--since 30d] [--json]
```

Walks handoffs, builds frequency table, runs clustering, writes cache to
`.planning/.eval-clusters-cache.json`. Use `--since` to limit to recent
handoffs (useful for drift detection over time).

### List (read cached results)

```sh
gad eval clusters list [--json]
```

Prints the last computed cluster taxonomy from cache. Fast; no filesystem
scan. Use in CI or status checks.

### Enumerate (for eval matrix integration)

```sh
gad eval clusters enumerate
```

Outputs the cluster representatives as JSON. Intended for programmatic
consumption by `gad eval matrix --cluster-driven` (integration ships in
follow-on to phase 112 — see `loadClusterRepresentatives()` in
`bin/commands/eval/clusters.cjs`).

### Matrix integration (follow-on)

The existing `gad eval matrix` / `gad species run` command is NOT modified
by this phase (constraint: don't break default behaviour). Integration path:

1. `gad eval clusters enumerate` → JSON representatives.
2. Eval orchestrator iterates representatives, calls `gad species run --project <p> --context <ctx> --risk <r>...` per cluster.
3. Or: `bin/commands/eval/clusters.cjs` exports `loadClusterRepresentatives(repoRoot)` for in-process consumption.

---

## Refreshing the taxonomy

Run `gad eval clusters scan` whenever a phase closes with new handoff patterns,
or at the start of a new eval sprint. The clustering is deterministic given the
same handoff corpus, so results are reproducible.

Cluster labels are derived from `LABEL_RULES` in `lib/orthogonality/index.cjs`.
Add new rules there when new `estimated_context` values emerge (e.g. `migration`,
`integration`). The rule table matches on partial dims; most-specific rule wins.

---

## Relation to handoff-clusters.md

`references/handoff-clusters.md` is the earlier hand-authored taxonomy (6 archetypes,
2026-05-04). This document (`eval-clusters.md`) is the **data-driven equivalent**:
same goal, derived from live corpus instead of a priori design. The two should
converge as the handoff corpus grows. Use `eval-clusters.md` for eval matrix
configuration; use `handoff-clusters.md` for human orientation / handoff-creation hints.
