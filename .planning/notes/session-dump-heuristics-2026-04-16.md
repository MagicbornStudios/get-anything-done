# Session cost shape + agent profile modes

**Superseded title:** "Session dump heuristics" — the heuristic-triggered
auto-dump proposal is **rejected (too fragile)**. What survives: the cost
analysis and the configurable agent-profile model.

**Source:** Session 2026-04-16d. Operator flagged the cost of loading
~5286k tokens for a full session, asked about the skill/context tradeoff,
asked how to spot when to restart. Follow-up correction: heuristic-dump is
too fragile; junior/senior analogy had been inverted.

**Anchor decisions:** gad-17 (session exhaustion policy), gad-195 (static
vs active context).

## Cost shape (valid — stays)

- **Session load:** ~5286k tokens for full snapshot + skills + agent
  prompts on this repo. Sunk cost of any session start.
- **Per-turn input:** linear growth as conversation extends. Every turn
  re-sends full history. Turn 100 pays for turns 1–99 again.
- **Cache TTL:** Anthropic prompt cache is 5 minutes. Idle gaps cold-start.
- **Attention quality:** degrades as irrelevant history fills the window.
  Accuracy on the current task drops even though old turns are still there.

## Skill/context tradeoff — junior vs senior (corrected)

Operator correction (2026-04-16d): the analogy was inverted in the first
draft. Correct framing:

> "A junior has less, therefore is less expensive."

Mapping to agent sessions:

| role | skills / context equipped | cost | capability |
|--|--|--|--|
| **junior agent** | **fewer** skills preloaded | **cheap** | narrower — limited to what was given |
| **senior agent** | **more** skills preloaded | **expensive** | broader — more tools on hand |

This is the *equipment* model, not the *internal-knowledge* model. The
senior-owns-it-internally read is a real human distinction but **not what
we are modeling here**. In our system, capability comes from what we
*provide* the agent in context. Less equipment = cheaper. More equipment =
costlier and more capable.

Implication: "senior mode" is the **bigger, more expensive** configuration,
not the leaner one.

## Proposed profile modes (configurable, not heuristic)

Three modes, selectable at session start via `gad snapshot --profile <mode>`
or `gad-config.toml [session] default_profile = "<mode>"`:

| mode | base tokens | skills | use |
|--|--|--|--|
| **junior** | ~2k (STATE + ROADMAP only) | 0 preloaded | small scoped tasks, cheap turns, accept narrower capability |
| **balanced** | ~4k (STATE + ROADMAP + top 5 skills + recent decisions) | 5 | default |
| **senior** | ~7k (full static+active snapshot) | all equipped | broad cross-context work, unfamiliar surfaces, willing to pay for capability |

This is a **configuration** knob, not a triggered behavior. The operator
picks the mode when starting the session. No runtime heuristic decides
for them.

## Rejected: heuristic-driven auto-dump

**Proposed and discarded (2026-04-16d): too fragile.**

The earlier draft of this note listed "signals that favor DUMP" (task
boundary crossed, context > 60%, cognitive zone switch, etc.) and
mechanization paths (embedding distance, phase graph walk, file-zone
overlap). Operator ruled this out:

- Rule-based triggers mis-fire on edge cases
- The cost of a wrong auto-dump (fresh 5286k cold-start when the session
  was fine) exceeds the savings
- Mechanization paths (embeddings, graph walks) add their own complexity
  and still produce false positives
- Operator prefers explicit control over mid-session behavior

What the agent MAY still do (per gad-17): **loosely suggest** a restart at
clean planning boundaries when context is filling, with one-line
reasoning. The operator decides. Never a rule, never unilateral.

## What this means practically

1. Ship the three profile modes as a configuration feature (junior /
   balanced / senior). Operator picks per session.
2. Do NOT build an auto-dump detector.
3. Keep gad-17's "loosely suggest at clean boundaries" behavior unchanged.
4. The cost analysis above is worth publishing as landing-site content
   (see todo `site-article-parallel-subagent-cost` — extend to cover
   session cost as well).

## Related todos

- `structural-parallelism-task-outbox` — scratch-file pattern for parallel
  agent work
- `lightweight-agent-and-scoped-snapshot` — the scoped snapshot machinery
  that makes junior mode possible
- `site-article-parallel-subagent-cost` — candidate surface for publishing
  the cost-shape analysis

## Next step

Graduate profile modes (junior/balanced/senior) to a real `gad snapshot
--profile <mode>` flag. Depends on the scoped-snapshot work in
`lightweight-agent-and-scoped-snapshot`. Until then, this note is the
operating playbook on cost, not on dumps.
