# Session dump heuristics — when to restart a GAD session

**Source:** Session 2026-04-16d operator question: *"we need to determine
better how to spot when to dump context and begin a new session. Like a
learning session, I'm sure it's just distinctive tasks that are different.
But what about skills and etc? ... the more skills you have and context, the
slower and more expensive you are. Sounds like a junior vs a senior. We need
to find our operational balances we like and be able to easily configure."*

**Anchor decisions:** gad-17 (session exhaustion policy refinement),
gad-195 (static vs active context).

## The cost shape

- **Session load:** ~5286k tokens for full snapshot + skills + agent prompts
  on this repo (operator measurement). This is the sunk cost of any session
  start.
- **Per-turn input:** linear growth as conversation extends. Every turn
  re-sends full history. Turn 100 pays for turns 1–99 again.
- **Cache TTL:** Anthropic prompt cache is 5 minutes. Idle gaps cold-start.
- **Attention quality:** degrades as irrelevant history fills the window.
  Accuracy on the current task drops even though old turns are still there.
- **Skill/context tradeoff:** more installed skills = larger base context =
  slower + more expensive. Fewer skills = faster but fewer available
  capabilities. Analogy: **junior vs senior** — senior knows less explicit
  methodology, just moves. Junior needs the playbook inlined.

## Signals that favor DUMP (restart now)

| signal | why |
|--|--|
| **Task boundary crossed and committed** | rehydration story is clean; planning docs hold the state |
| **Cognitive zone switch** | e.g. site copy → CLI implementation, or implementation → discuss-phase |
| **Context > 60–70%** | attention degradation starts to show |
| **Auto-compact imminent** | planned restart beats forced compaction mid-task |
| **In-head state is empty** | no "what we ruled out" trail carrying weight |
| **Next chunk is mechanical + scoped** | scoped snapshot + one skill can rehydrate cleanly |

## Signals that favor CONTINUE (don't dump yet)

| signal | why |
|--|--|
| **Mid-task with unwritten state** | restart loses context not yet in docs |
| **Investigation trail matters** | what we ruled out carries weight |
| **Next thing depends on subtle recent context** | diff review, bug chase, subtle refactor |
| **User in flow** | restart interrupts thinking |
| **Small incremental edits with cache hot** | cache hit is cheaper than restart |
| **Rehydration cost > remaining work cost** | if task is 5 min and restart is 5286k, don't restart |

## Proposed operational balances (configurable)

Three modes, picked at `gad snapshot --profile <mode>`:

| mode | base tokens | skills | use |
|--|--|--|--|
| **senior** | ~2k (STATE + ROADMAP only) | 0 preloaded | experienced operator, trust working memory, fast turns |
| **balanced** | ~4k (STATE + ROADMAP + top 5 skills + recent decisions) | 5 | default |
| **junior** | ~7k (full static+active snapshot) | all equipped | onboarding, cross-context switching, unfamiliar project |

Configure via `gad-config.toml`:

```toml
[session]
default_profile = "balanced"
skill_pressure_threshold = 5  # skills trigger when N+ installed → warn & suggest senior mode
```

## "Learning session" trigger — distinctive task detection

Operator hypothesis: **a task distinctive from current context is a dump
signal**. Mechanization candidates:

1. **Embedding distance** — compute current active task vs prior session's
   primary task using embeddings. Distance > threshold → suggest dump.
2. **Phase graph walk** — if next task is in a different phase cluster on
   the planning graph (no edges from current phase), suggest dump.
3. **File-zone overlap** — if next task's file refs have < 20% overlap with
   recent commits, suggest dump.
4. **Simple heuristic** — if `gad snapshot` shows `<next-action>` names a
   different TRACK / PHASE / DOMAIN than current, suggest dump.

Option 4 is shippable today with zero ML. Options 1–3 are follow-ups.

## Restart contract

When dumping, leave the repo in a state that rehydrates to exactly the
in-flight task in < 1 snapshot:

- ✅ All intentional edits committed + pushed
- ✅ STATE.xml `<next-action>` names the exact next task
- ✅ TASK-REGISTRY.xml statuses current
- ✅ Any unresolved decisions captured in DECISIONS.xml or a session note
- ✅ Submodule pointer bumped in outer repo (if relevant)

If any ✅ fails, finish that before dumping — don't shift cognitive load onto
the next session's agent.

## Related todos

- `structural-parallelism-task-outbox` — scratch-file pattern reduces
  shared-file contention across parallel agents
- `lightweight-agent-and-scoped-snapshot` — agent profiles + scoped snapshots,
  the mechanization path for this heuristic
- `site-article-parallel-subagent-cost` — landing article where this
  reasoning should eventually be published

## Next step

Graduate to a decision (`gad-NNN: Session dump heuristics`) once one of
the proposed mechanization paths has been piloted. Until then, this note
is the operating playbook.
