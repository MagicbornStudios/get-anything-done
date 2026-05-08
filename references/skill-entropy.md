# Skill Entropy

**Phase:** 88 - Skill Entropy formalization  
**Task:** 88-01  
**Decisions:** GLOBAL-D-291, gad-145, gad-220, gad-222

---

## Purpose

Per `GLOBAL-D-291`, the formal name for the platform's optimization target is
**Skill Entropy**.

Pressure measures **how much resistance** a task class generates.
Skill Entropy measures **how scattered that resistance is**.

- High pressure + low entropy: the work is hard, but the failure shape is coherent.
  A skill can emerge.
- High pressure + high entropy: the work is hard and the failures are scattered.
  No reusable skill shape exists yet.
- Low pressure + low entropy: the task class is already domesticated.

This makes Skill Entropy parallel to Shannon entropy:

- Shannon: uncertainty over symbols emitted by a source
- Skill Entropy: uncertainty over failure/decomposition patterns emitted by a task class

Pressure is the intensity term from
`vendor/get-anything-done/references/pressure-formula.md`.
Skill Entropy is the structural term.
The platform should optimize for **pressure being converted into entropy collapse**.

## Task class

Let `c` be a **task class**: a normalized family of sessions that are "the same kind
of work" even across different concrete files or projects.

Examples:

- "author canonical math reference"
- "adapt runtime telemetry writer"
- "repair failing CLI contract test"

The telemetry source for the metric is
`.planning/.sessions/<id>/events.jsonl` from phase 89-01.

## Ideal form

For a task class `c`, each completed session emits a triple:

`z = (s, r, p)`

where:

- `s` = decomposition shape bucket
- `r` = retry-profile bucket
- `p` = pressure-category signature

The ideal information-theoretic definition is the joint entropy:

```text
H_joint(c) = -sum_z P(z | c) log2 P(z | c)
```

This is the cleanest Shannon-parallel statement: if the same task class keeps
emitting many different `(shape, retry, pressure)` tuples, uncertainty is high.
If sessions converge on the same tuple, entropy collapses.

In practice, the joint space is sparse early on, so the canonical estimator is a
weighted sum of normalized marginal entropies.

## Canonical estimator

For task class `c`, derive three empirical distributions.

### 1. Decomposition-shape entropy

Let `S_c` be the set of canonical decomposition shapes observed for `c`.

```text
H_shape(c) = -sum_{s in S_c} p_s log2 p_s
```

where `p_s` is the fraction of sessions in class `c` with shape `s`.

### 2. Retry entropy

Let `R_c` be the retry buckets observed for `c`.
Use buckets instead of raw counts so one outlier session does not explode the symbol
space. Default buckets:

- `0`
- `1`
- `2`
- `3+`

Then:

```text
H_retry(c) = -sum_{r in R_c} p_r log2 p_r
```

where `p_r` is the fraction of sessions in retry bucket `r`.

### 3. Pressure-category entropy

Let `K` be the set of pressure categories from the 89-01 telemetry schema:

- `retry`
- `file-modified`
- `hook-block`
- `tool-error`
- `rate-limit`
- `deviation`
- `recovery`
- `ratelimit-rotation`

Aggregate by **pressure weight**, not raw count, so the metric stays aligned with
the pressure system.

For category `k`:

```text
W_k(c) = sum_{e in events(c, k)} weight(e)
P_k(c) = W_k(c) / sum_j W_j(c)
H_pressure(c) = -sum_{k in K_c} P_k(c) log2 P_k(c)
```

`K_c` is the subset of categories actually observed for class `c`.

## Normalized Skill Entropy

Normalize each component into `[0, 1]`:

```text
h_shape(c)    = H_shape(c)    / log2(|S_c|)
h_retry(c)    = H_retry(c)    / log2(|R_c|)
h_pressure(c) = H_pressure(c) / log2(|K_c|)
```

with the convention that a component is `0` when only one bucket/category has been
observed.

The canonical metric is:

```text
H_skill(c) = alpha * h_shape(c)
           + beta  * h_retry(c)
           + gamma * h_pressure(c)
```

subject to:

```text
alpha + beta + gamma = 1
alpha, beta, gamma >= 0
```

Default weights:

```text
alpha = 1/3
beta  = 1/3
gamma = 1/3
```

Interpretation:

- `H_skill(c) ~= 0`: entropy collapse; strong candidate that a reusable skill already
  exists or is emerging now
- `H_skill(c) ~= 0.5`: partial convergence; the task class is stabilizing but still
  emits multiple working/failing shapes
- `H_skill(c) ~= 1`: no stable shape; the task class is still scattered

## Relationship to the pressure formula

The pressure formula from `pressure-formula.md` answers:

```text
How much real resistance did the project encounter?
```

Skill Entropy answers:

```text
Was that resistance coherent enough to compress into a skill?
```

The two metrics should be read together:

- High pressure, high entropy: explore; do not prematurely canonize
- High pressure, falling entropy: candidate-skill zone
- High pressure, low entropy: the class is ready to be formalized or already has a skill
- Low pressure, low entropy: maintenance path; likely solved

So the platform does not optimize for "less work."
It optimizes for **turning repeated pressure into lower-entropy execution**.

## Worked examples

Assume the default equal weights.

### Example A - entropy collapse: skill emerging

Task class: "write reference math docs"

Observed distributions:

- decomposition shapes: `[0.97, 0.03]`
- retry buckets: `[0.98, 0.02]`
- pressure categories: `[0.96, 0.03, 0.01]`

Calculations:

```text
H_shape    = 0.194   ; h_shape    = 0.194 / log2(2) = 0.194
H_retry    = 0.141   ; h_retry    = 0.141 / log2(2) = 0.141
H_pressure = 0.274   ; h_pressure = 0.274 / log2(3) = 0.173

H_skill = (0.194 + 0.141 + 0.173) / 3 = 0.169
```

Interpretation: near-collapse. The task class is converging on one decomposition,
almost never retries, and pressure lands in one known category. A documentation skill
is emerging.

### Example B - stable mid: skill in progress

Task class: "runtime adapter implementation"

Observed distributions:

- decomposition shapes: `[0.80, 0.15, 0.05]`
- retry buckets: `[0.78, 0.15, 0.07]`
- pressure categories: `[0.75, 0.15, 0.07, 0.03]`

Calculations:

```text
H_shape    = 0.884   ; h_shape    = 0.884 / log2(3) = 0.558
H_retry    = 0.920   ; h_retry    = 0.920 / log2(3) = 0.580
H_pressure = 1.153   ; h_pressure = 1.153 / log2(4) = 0.577

H_skill = (0.558 + 0.580 + 0.577) / 3 = 0.572
```

Interpretation: still broad, but not chaos. The class has recurring structure, yet
multiple decomposition paths and several pressure categories remain live. This is the
"skill forming" zone.

### Example C - scattered high: no skill yet

Task class: "cross-system rescue/debug under live pressure"

Observed distributions:

- decomposition shapes: `[0.25, 0.25, 0.25, 0.25]`
- retry buckets: `[0.25, 0.25, 0.25, 0.25]`
- pressure categories: `[0.20, 0.18, 0.17, 0.16, 0.15, 0.14]`

Calculations:

```text
H_shape    = 2.000   ; h_shape    = 2.000 / log2(4) = 1.000
H_retry    = 2.000   ; h_retry    = 2.000 / log2(4) = 1.000
H_pressure = 2.578   ; h_pressure = 2.578 / log2(6) = 0.997

H_skill = (1.000 + 1.000 + 0.997) / 3 = 0.999
```

Interpretation: essentially maximum entropy. Sessions do not agree on how to attack
the problem, retries scatter across buckets, and pressure categories are nearly flat.
There is no reusable skill shape yet.

## Computational recipe

Pseudocode for computing `H_skill` from 89-01 telemetry:

```text
function computeSkillEntropy(projectRoot):
  sessionsDir = projectRoot + "/.planning/.sessions"
  byTaskClass = map()

  for each sessionDir in listDirectories(sessionsDir):
    events = readJsonl(sessionDir + "/events.jsonl")
    if events is empty:
      continue

    if not hasEvent(events, kind="session-end", outcome="completed"):
      continue

    stepLabels = mapStepIdToLabel(events)
    childMap = mapParentToChildren(events where kind="decomposition")
    attributedSteps = [e.step_id for e in events where e.kind == "attribution-link"]

    taskClass = deriveTaskClass(events, stepLabels, attributedSteps)
    if taskClass is null:
      continue

    shape = canonicalizeShape(childMap, stepLabels)
    retryBucket = bucketizeRetries(sum(e.retries for e in events where e.kind == "step-end"))

    pressureWeights = map(default=0)
    for each e in events where e.kind == "pressure-event":
      pressureWeights[e.category] += e.weight

    byTaskClass[taskClass].shapes.push(shape)
    byTaskClass[taskClass].retryBuckets.push(retryBucket)
    byTaskClass[taskClass].pressureWeightMaps.push(pressureWeights)

  result = map()

  for each taskClass in byTaskClass:
    shapeDist = empiricalDistribution(byTaskClass[taskClass].shapes)
    retryDist = empiricalDistribution(byTaskClass[taskClass].retryBuckets)

    categoryTotals = map(default=0)
    for each weightMap in byTaskClass[taskClass].pressureWeightMaps:
      for each (category, weight) in weightMap:
        categoryTotals[category] += weight
    pressureDist = normalize(categoryTotals)

    hShape = normalizedEntropy(shapeDist)
    hRetry = normalizedEntropy(retryDist)
    hPressure = normalizedEntropy(pressureDist)

    hSkill = (hShape + hRetry + hPressure) / 3

    result[taskClass] = {
      h_shape: hShape,
      h_retry: hRetry,
      h_pressure: hPressure,
      h_skill: hSkill,
      sample_size: count(byTaskClass[taskClass].shapes)
    }

  return result

function deriveTaskClass(events, stepLabels, attributedSteps):
  labels = []
  for each stepId in attributedSteps:
    if stepLabels contains stepId:
      labels.push(normalizeLabel(stepLabels[stepId]))
  if labels not empty:
    return modal(labels)

  rootLabels = [normalizeLabel(e.label) for e in events where e.kind == "step-start" and e.parent_step == null]
  if rootLabels not empty:
    return modal(rootLabels)

  intent = first session-start.intent if present
  return normalizeLabel(intent)

function canonicalizeShape(childMap, stepLabels):
  roots = childMap[null] or []
  return renderTree(roots, childMap, stepLabels)

function normalizedEntropy(dist):
  n = number of nonzero buckets in dist
  if n <= 1:
    return 0
  raw = -sum(p * log2(p) for p in dist.values() if p > 0)
  return raw / log2(n)
```

## Operational notes

- `H_skill` is only meaningful with repeated observations. A single session is not a
  distribution.
- Sample size should be reported beside the metric. High entropy on `n=2` is weak
  evidence.
- Retry bucketing is intentionally coarse. The metric is about structural convergence,
  not exact retry counts.
- Pressure categories should stay consistent with the 89-01 schema. If the schema adds
  new categories, readers should absorb them as new buckets rather than rewriting the
  metric.
- When sample sizes are large enough, `H_joint(c)` can be reported beside the canonical
  marginal estimator as a refinement.

## Summary

Shannon entropy measures uncertainty over messages.
Skill Entropy measures uncertainty over how a task class is executed and where it fails.

That is the measurable backbone of the platform:

```text
pressure supplies the force
skill entropy tells whether that force is collapsing into reusable form
```

---

## Benchmark suite

The benchmark suite defines the measurable input signals that feed the
entropy formula at the implementation layer. Each signal has a known unit
and a weighted contribution to the event-type distribution used in
`H(S,t)`.

| Signal | Unit | Source | Contribution |
|---|---|---|---|
| `handoff-claim-time` | seconds (mean open→claim) | `.planning/handoffs/claimed/` frontmatter `claimed_at` - `created_at` | Time a task sits unclaimed — longer = higher pressure |
| `retry-count` | sum of `unclaim_history` lengths | `.planning/handoffs/{open,claimed}/` `unclaim_history` array | Each unclaim is a failed dispatch — counts direct retries |
| `tool-call-density` | tool-call events per session | `.planning/sessions/*.telemetry.jsonl` `kind=tool-call` | High density can indicate thrashing or productive complexity |
| `worker-mailbox-depth` | count of open handoffs at snapshot time | `.planning/handoffs/open/` directory count | Work waiting = latent load; unbounded queue = high pressure |
| `runtime-rate-limit` | count of rate-limit events in window | `.planning/.gad-log/*.jsonl` + worker `log.jsonl` `kind=runtime-rate-limit-on-call` | External choke on agent execution rate |
| `edit-conflict` | count of file-modified-since-read errors | `.planning/.gad-log/` `kind=file-modified-since-read` | Concurrent write collisions — highest in multi-agent sessions |
| `discipline-rule-fail` | count of discipline rule failures | `.planning/team/workers/*/log.jsonl` `kind=discipline-rule-fail` | Structural violations; amplified by H_total in rubric |

The benchmark formula applied to these inputs (see `lib/entropy/benchmark.cjs`):

```text
H(S,t) = -sum_i p_i * log2(p_i)
  where p_i = count(signal_i) / sum_j count(signal_j)
  normalized to [0,1] via log2(n_nonzero_buckets)

D(S,t) = unique_decompositions / total_decompositions   (from v2.cjs)

H_total = alpha * H + beta * D
  defaults: alpha = 0.7, beta = 0.3
```

Interpretation alignment between the canonical estimator and the benchmark:
- The canonical estimator uses `h_shape`, `h_retry`, `h_pressure` from session telemetry.
- The benchmark uses observable log signals as a proxy when full telemetry is not yet wired.
- The two converge as `89-01` telemetry matures. Until then, the benchmark provides non-zero, non-fabricated signal.

---

## Eval rubric

For a **generation** (a complete dev session ending in a closed milestone), the rubric
scores five dimensions. Each is normalized to `[0, 1]` where `1.0` is cleanest execution.

| Dimension | Weight | Scoring logic |
|---|---|---|
| `total-entropy` | 0.30 | `1 - H_total` from benchmark snapshot |
| `peak-entropy` | 0.15 | `1 - peak_H_total` within window (approximated as current snapshot until daily log is wired in phase 107) |
| `entropy-decay-rate` | 0.20 | Compare first-half vs second-half H_total. Positive decay (entropy dropped) → score 1.0. Zero or negative → score 0.0. Normalized over `[-0.3, +0.3]` range. |
| `discipline-weighted-by-entropy` | 0.20 | Discipline failures are amplified by H_total. `score = 1 - (fail_rate * H_total * 10)`. High entropy + many violations → near zero. |
| `handoff-flow-efficiency` | 0.10 | `1 - (total_retries / total_handoffs)`. High unclaim rate → low score. |
| `decomposition-diversity` | 0.05 | `D` directly from v2 computation. Richer skill expression = higher score. |

Composite rubric score:

```text
rubric_score = sum_i (weight_i * score_i)
```

Use `gad entropy benchmark --json` to get per-dimension `score` and `evidence`.

---

## Cross-generation comparison

The **operational hypothesis** of the platform: species evolution should reduce `H_total`
across generations. A generation ladder tests this.

One row per generation (time-bounded dev session), sortable by `H_total` ascending:

| RANK | ID | SINCE | UNTIL | H | D | H_TOTAL |
|---|---|---|---|---|---|---|
| 1 | gen-v2 | 2026-05-01 | 2026-05-07 | 0.312 | 0.410 | 0.342 |
| 2 | gen-v1 | 2026-04-01 | 2026-04-30 | 0.581 | 0.280 | 0.491 |

**Reading the ladder:**
- Lower H_total at higher rank = species learning. The platform is compressing pressure into skill.
- Increasing D at lower H = skill diversity expanding as entropy collapses. Expected pattern during skill emergence.
- Stagnant or rising H_total across generations = evolution is not compressing pressure. Investigate skills catalogue.

Run via:

```sh
gad entropy compare --generations gen-v1:2026-04-01:2026-04-30,gen-v2:2026-05-01:2026-05-07
```

---

## Marketing explainer

**What is Skill Entropy?**

When an AI agent works on a problem, it creates a trace — a record of where it struggled,
how many times it retried, which tools it reached for, and where it got blocked. On any
single task that trace is noise. Across hundreds of tasks of the same kind, it becomes
a signal.

Skill Entropy is a number between 0 and 1 that measures how scattered those traces are.
A score near 0 means every agent session of this type looks the same: one reliable path,
minimal retries, pressure landing in one known category. The task class is domesticated.
A score near 1 means no two sessions agree on what to do, and failures land in every
possible category simultaneously. No skill exists yet.

The GAD platform tracks Skill Entropy over time and across agent generations. When a task
class moves from high entropy to low entropy, that is the signal that a reusable skill is
forming. The platform captures it, formalizes it, and makes the next generation of agents
start from a lower entropy baseline. That is what we mean by "AI that gets better at work
by doing work." Not fine-tuning on token completions — evolution through documented entropy
collapse.

---

## API

| Command | Description |
|---|---|
| `gad entropy snapshot [--projectid X] [--since 7d\|YYYY-MM-DD] [--json]` | Current H/D/H_total with dimension breakdown and input signal table |
| `gad entropy benchmark [--projectid X] [--since X] [--json]` | Full rubric evaluation + entropy combo; returns composite score and per-dimension evidence |
| `gad entropy compare --generations id:since:until,... [--json]` | Cross-generation table sorted ascending by H_total; tests the entropy-collapse hypothesis |
| `gad entropy explain` | Prints this reference in compact form (framing, formula, benchmark suite, rubric, CLI) |

Implementation files:

| File | Purpose |
|---|---|
| `lib/entropy/compute.cjs` | v1 — observable-signal pressure MVP (phase 88 stub, formalized in 107-06) |
| `lib/entropy/v2.cjs` | v2 — adds decomposition-diversity dimension D (phase 89) |
| `lib/entropy/benchmark.cjs` | Benchmark library — `runBenchmark`, `crossGenerationCompare` (phase 88) |
| `lib/entropy/rubric.cjs` | Rubric library — `RUBRIC_DIMENSIONS`, `scoreRubric` (phase 88) |
| `bin/commands/entropy.cjs` | CLI entry point — `snapshot`, `benchmark`, `compare`, `explain` (phase 88) |
| `references/skill-entropy.md` | This document — canonical math + benchmark + rubric + marketing (phase 88) |
| `references/pressure-formula.md` | Phase-level pressure formula — feeds into H estimation |
