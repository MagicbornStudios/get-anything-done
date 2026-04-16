# Pressure Formula — Information-Theoretic Project Complexity

**Decisions:** gad-145, gad-220, gad-222

## The three entropy dimensions

Every project phase has three sources of complexity, each mapping to a
distinct information-theoretic concept:

### 1. Resolved entropy (H_d) — decisions that answered known questions

When a question of high importance presents itself and gets resolved, that's
a decision. Each decision reduces the project's state space by eliminating
a branch of uncertainty.

    H_d = D * log_2(T/D + 1)

- D = decisions produced in the phase
- T = total tasks in the phase
- The log term captures diminishing returns: 10 decisions in 10 tasks is more
  intense than 10 decisions in 100 tasks

**Shannon parallel:** This is analogous to Shannon entropy H(X) = -sum p(x_i) log_2 p(x_i).
Each decision is an "information event" that resolves uncertainty. The D/T ratio
is the inverse of redundancy — high D/T means every task carried real information.

### 2. Latent entropy (H_l) — unknown unknowns that appeared as crosscuts

A crosscut task touches >= 2 subsystems (cli + site, eval + skill, etc.).
When a crosscut has NO associated decision, it means the complexity was invisible
until it forced itself across system boundaries. Nobody even formulated the question.

    H_l = L * log_2(C/L + 1)

- L = latent crosscuts (crosscuts without any associated decision)
- C = total crosscuts

**This is the hardest kind of complexity.** A decision means someone was aware
enough to ask. A latent crosscut means the system surprised everyone.

### 3. Task volume (T) — raw work count

Simple count of tasks. The baseline.

## Full formula (v3)

    P = T + C_a * w_c + C_l * w_l + D * w_d + (D/T) * w_r

| Symbol | Meaning | Default weight |
|--------|---------|---------------|
| T | Total tasks | 1 (implicit) |
| C_a | Anticipated crosscuts (have associated decision) | w_c = 2 |
| C_l | Latent crosscuts (no associated decision) | w_l = 4 |
| D | Decisions produced | w_d = 3 |
| D/T | Decision rate (information density) | w_r = 5 |

## Derived metrics

| Metric | Formula | Interpretation |
|--------|---------|---------------|
| Decision rate | D/T | Information density — how much uncertainty per task |
| Latent ratio | L/C | Project health — high = many surprises, low = well-anticipated |
| Decision entropy | H_d | Total resolved information content |
| Latent entropy | H_l | Total unresolved/surprise complexity |
| Total entropy | H_d + H_l | Combined information-theoretic complexity |

## Configuration

Weights are configurable in `self-eval-config.json`:

```json
{
  "pressure": {
    "crosscut_weight": 2,
    "latent_crosscut_weight": 4,
    "decision_weight": 3,
    "decision_rate_weight": 5,
    "high_pressure_threshold": 10
  }
}
```

## Relationship to Shannon

| Shannon | GAD |
|---------|-----|
| H(X) = -sum p(x_i) log_2 p(x_i) | H_phase = H_d + H_l |
| Entropy of a message source | Complexity of a project phase |
| Redundancy = 1 - H/H_max | Decision rate = D/T (inverse redundancy) |
| Mutual information I(X;Y) | Crosscuts (tasks spanning subsystem boundaries) |
| Channel capacity | Sprint size (max tasks per phase) |
| Noise | Latent crosscuts (surprise complexity) |

The key insight: Shannon measures information in messages. We measure information
in project work. Decisions are the "symbols" — each one carries bits of resolved
uncertainty. Latent crosscuts are the "noise" — complexity the channel didn't
account for. The D/T ratio is our version of entropy rate — information per
unit of work.
