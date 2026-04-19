# 35-10 SDK context-engine review — decision draft (2026-04-19)

Extends `.planning/notes/context-engine-hydration-questions-2026-04-14.md`. Answers the 8 open questions captured there, proposes an architecture, and links into the runtime-matrix decision layer (`gad runtime select`) so context-hydration and runtime-selection converge on one query-driven model.

This is a **decision draft** — operator approves and I promote to `DECISIONS.xml` as gad-275 / gad-276 / gad-277.

---

## Ground truth since 2026-04-14

Three things changed that the original note didn't see:

1. **Runtime matrix shipped** (`gad runtime select`). Same conceptual question at one level up — given (task-shape, run-mode, availability), pick runtime + pre-load skills. Writes audit records to `.gad/matrix/`. The context-engine and the runtime matrix are solving the same problem: "what context do we need for *this* specific dispatch?"
2. **Graph query layer shipped** (`gad query`, per decision gad-201). ~12.9× token savings vs raw XML. The SDK can hydrate from graph queries instead of file reads.
3. **TUI dispatch wire exists** (`packages/gad-tui`). Every dispatch now carries a project-context preamble; we already know which task / which phase is being executed.

The matrix + query layer + TUI preamble give us the infrastructure the original 2026-04-14 note was missing. The decision is now unblocked.

---

## Answers to the 8 open questions

| # | Question | Answer |
|---|---|---|
| 1 | Fixed per-phase manifest, or query-driven from scoped snapshot? | **Hybrid: phase-scoped budget + query-driven content.** Keep the phase → budget mapping (Execute gets ~2k tokens of context, Research gets ~6k, etc.) but fill the budget via a query layer, not a static file list |
| 2 | For execute, is REQUIREMENTS > DECISIONS or vice versa? | **DECISIONS > REQUIREMENTS at execute time.** By the time a phase is executing, plan is locked; decisions that constrain *how* to implement (scope bounds, security rules, arch invariants) are higher-leverage than re-reading requirements. REQUIREMENTS stays high-value at Research/Plan |
| 3 | Execute prompts: slice of relevant decisions, not full file? | **Yes — slice.** Filter by (phase tags, task refs, file refs, recency). Full `DECISIONS.xml` is 270+ entries; relevant slice is usually 5-15 |
| 4 | How to decide decision relevance? | **Four signals, ranked:** (a) explicit `decision_refs` on the plan / task, (b) shared phase tag, (c) file-ref overlap with plan's touched files, (d) recency within the current sprint window. A decision matching ≥2 signals is always included; ≥1 signal + recency is included if budget allows |
| 5 | Is `CONTEXT.md` still the right discuss/research artifact? | **Yes but narrower scope.** Keep as the discuss→research handoff narrative. Don't duplicate what state/decisions/tasks carry — it's for the "what are we even trying to accomplish and why" framing that doesn't fit structured ledgers |
| 6 | Should `PLAN.md` carry `context_refs` / `decision_refs` strongly? | **Yes, make required.** Every plan produces `decision_refs: [gad-XYZ,...]` and `context_refs: [file/path:lineno,...]`. The planner already has this info; making it structured makes execute-time hydration deterministic |
| 7 | Does current manifest under-hydrate execute? | **Yes, empirically.** Execute only gets STATE + config. Anything beyond task title/goal lives in the runner's prompt or in skills. That's compensation, not hydration. The fix is to include the plan's `decision_refs` + a graph-query over `files_recently_touched_in_phase` |
| 8 | Which surfaces can read `.planning/config.json` directly? | **None going forward.** Treat as compat-only. Load through `gadConfig.load()` / `gad query`. Audit with `grep -rn "config.json"` — every raw read is a migration target |

---

## Proposed architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase prompt build-up (new ContextEngine)                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Phase budget lookup   → PhaseBudget { tokens, slots }        │
│ 2. Always-on slot        → STATE.xml                            │
│ 3. Plan-driven slots     ← plan.context_refs + decision_refs    │
│ 4. Query-driven slots    ← gad query (scoped to phase/task)     │
│ 5. Skill-preload slots   ← from runtime-matrix decision         │
│ 6. Budget enforcer       → drops lowest-rank slots past budget  │
└─────────────────────────────────────────────────────────────────┘
         │                              ▲
         ▼                              │
    prompt text                   audit record
                                   `.gad/hydration/<ts>.json`
```

**Key pivots:**

- `PHASE_FILE_MANIFEST` becomes `PHASE_BUDGET_MANIFEST` — keyed on phase type, returns a budget + slot-priority list, not a file list
- `ContextEngine.load()` calls three resolvers in order: plan-ref resolver, graph-query resolver, fallback-file resolver
- Output is ranked + truncated to budget
- An audit record writes to `.gad/hydration/<ts>.json` (mirrors the matrix audit) so we can dogfood the token-overhead metric from phase 42.1-04

**Runtime matrix integration:**

`gad runtime select` already emits `appliedSkills`. Those skills often carry their own context-injection instructions (e.g. `inject-recent-failures-before-repair-loop`). Feed the matrix's `appliedSkills` into the ContextEngine as a slot source so skill-driven context overlays phase-driven context naturally.

```
adapter.start({ prompt, …, contextSlots: matrix.appliedSkills })
```

One query, one decision record, one hydration record. The three audit trails stay aligned.

---

## Migration path

Five steps, each commit-safe:

1. **Add structured refs to PLAN.md schema** — `<context_refs>` and `<decision_refs>` elements. Planner (already subagent) fills them. Backwards-compatible: missing refs falls through to existing behavior.
2. **Write `ContextEngine.loadPlanRefs(planDir)`** — parses plan-refs, resolves to concrete file/line slices. Lands next to existing manifest loader. No integration yet.
3. **Wire `gad query` into ContextEngine** — add a `GraphResolver` that takes `(phase, taskId)` and returns relevant-decisions slice. Flag-guarded: `GAD_CONTEXT_QUERY_DRIVEN=1`.
4. **Flip the default** — `GAD_CONTEXT_QUERY_DRIVEN=1` becomes on-by-default after one sprint of shadow-logging. Audit records show token-overhead drop on execute.
5. **Retire `PHASE_FILE_MANIFEST`** — convert to thin-shim that defers to the new engine. Delete after one more sprint of clean runs.

Target: one sprint per step (5 weeks).

---

## Proposed decisions (draft — promote to `DECISIONS.xml` on approval)

### gad-275: Phase hydration is budget-scoped, query-driven

**Context:** The inherited `PHASE_FILE_MANIFEST` in `sdk/src/context-engine.ts` is a fixed per-phase file list — too coarse for execute (under-hydrates) and too inheritance-driven for research/plan (reads whole files when relevant slices would do). Phase 42.1-04 added the `hydration` metric which exposed the overhead cost.

**Decision:** Phase context hydration is a **budget + slots** model. Budget is phase-specific (Execute ~2k, Research ~6k, Plan ~6k, Verify ~3k, Discuss ~1k) and fills via ranked slots: (a) plan-declared `context_refs` / `decision_refs`, (b) graph-query results scoped to phase/task, (c) runtime-matrix `appliedSkills` context, (d) fallback file reads for compatibility.

**Reasoning:** Keeps token-overhead bounded (the good part of the manifest) while letting content be query-driven (addresses under-hydration of execute and file-name bias of research/plan).

---

### gad-276: Execute prompts receive relevant-decisions slice, not full DECISIONS

**Context:** Execute currently hydrates only STATE + config. Meanwhile DECISIONS is 270+ entries and reading the full file at execute time is token-wasteful. Plans know which decisions are load-bearing.

**Decision:** Execute-phase prompts include a relevant-decisions slice computed from four signals: (a) explicit `decision_refs` on the plan/task, (b) shared phase tag, (c) file-ref overlap with plan's touched files, (d) recency within current sprint window. ≥2 signals always included; ≥1 signal + recency included if budget allows.

**Reasoning:** Replaces token-compensation in skills/prompts with structured hydration. Empirically, most execute sessions only need 5-15 decisions, not 270.

---

### gad-277: PLAN.md carries required `decision_refs` and `context_refs`

**Context:** Planners already know which decisions + files are load-bearing for execute but emit them as narrative prose. Not machine-readable → execute can't hydrate from them.

**Decision:** `PLAN.md` schema requires top-level `<decision_refs>` and `<context_refs>` elements. Planner subagents populate these; `gad plan-phase` validates non-empty. Legacy plans without refs fall through to graph-query + fallback resolvers (backwards-compatible).

**Reasoning:** Makes plan → execute hydration deterministic. Aligns with runtime-matrix `appliedSkills` structured output — both layers emit the context they decided on, operator / runner consumes the structured form.

---

## Open for operator call

- **Budget numbers** — the 2k/6k/6k/3k/1k phase budgets are a starting guess. Real numbers come from dogfooding the hydration audit for a sprint
- **`decision_refs` promotion timing** — decide in gad-277 whether to require refs immediately (breaks old plans) or phase-in after one sprint of migration
- **Whether to fold the runtime-matrix audit and the hydration audit into one `.gad/dispatch-audit/` dir** — cleaner for token-overhead analysis, but larger schema
- **Whether `CONTEXT.md` stays opt-in (current) or becomes required at discuss/research** — question 5 defers; could go either way

---

## Related

- `sdk/src/context-engine.ts` (the surface being changed)
- `sdk/src/phase-prompt.ts` (consumer — needs to accept new slot-ranked shape)
- `sdk/src/config.ts` (already canonical TOML, no changes)
- `bin/gad.cjs` runtime-select audit (`.gad/matrix/`) — the pattern hydration audit should mirror
- decision `gad-160` (inherited SDK review intent)
- decisions `gad-162`, `gad-163` (config-compat boundaries)
- decision `gad-201` (graph query is canonical lookup)
- task `42.1-04` (hydration metric — this decision makes it actionable)
