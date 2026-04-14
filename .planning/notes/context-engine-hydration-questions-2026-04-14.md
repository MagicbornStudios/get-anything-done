# Context Engine And Hydration Questions — 2026-04-14

## Why this note exists

Phase 42.1 closed the terminology and measurement cleanup:

- `gad-config.toml` is canonical config
- `.planning/config.json` is compatibility-only
- `loop_compliance` was replaced by `framework_compliance`
- hydration is now the context-overhead metric

While reviewing the SDK follow-through, one inherited surface still showed older assumptions:

- `sdk/src/context-engine.ts` was still hardcoded to `.planning/config.json`
- the phase file manifest still reflects an older "fixed file list per phase" model
- the manifest does not include any decision-aware hydration logic

This note captures the design questions before we answer them in code.

## Current repo truth

### What is now fixed

- `loadConfig()` in `sdk/src/config.ts` prefers canonical `gad-config.toml`
- `ContextEngine` now reads canonical `gad-config.toml` first and falls back to `.planning/config.json`
- prompt labeling now describes config as canonical TOML plus compatibility mirror, not JSON-only

### What is still intentionally unresolved

- whether phase hydration should stay a fixed manifest at all
- whether `REQUIREMENTS` or `DECISIONS` are the more important execution-time context surface
- whether scoped snapshot output should become the SDK's canonical phase context source instead of ad hoc file lists

## What the current manifest is really doing

The current manifest is a blunt context-budget tool.

- Execute: `STATE` + config
- Research: `STATE` + `ROADMAP` + `CONTEXT` + optional `REQUIREMENTS`
- Plan: `STATE` + `ROADMAP` + `CONTEXT` + optional `RESEARCH` + optional `REQUIREMENTS`
- Verify: `STATE` + `ROADMAP` + optional `REQUIREMENTS` + optional `PLAN` + optional `SUMMARY`
- Discuss: `STATE` + optional `ROADMAP` + optional `CONTEXT`

That restriction is not inherently bad. It keeps prompts smaller and prevents the runner from dumping the whole planning tree into every step. The open question is whether the current file choices are the right restrictions.

## Open questions

1. Should `ContextEngine` remain a fixed per-phase file manifest, or should it call into the same scoped snapshot/query layer that powers `gad snapshot`?
2. For execute-time context, is `REQUIREMENTS` usually more valuable than `DECISIONS`, or is the opposite true once a phase is already planned?
3. Should execute prompts receive a "relevant decisions" slice instead of the full `DECISIONS` file?
4. If we add decisions to phase hydration, how do we decide relevance: phase tags, task refs, file refs, recency, or explicit decision links from plans?
5. Is `CONTEXT.md` still the right durable discuss/research artifact, or should more of that guidance live in decisions/state/task metadata instead?
6. Should `PLAN.md` carry explicit `context_refs` or `decision_refs` strongly enough that the runner can hydrate from those instead of generic phase rules?
7. Does the current manifest under-hydrate execute, causing the runner to succeed only because prompts or skills compensate elsewhere?
8. Which remaining surfaces are allowed to read `.planning/config.json` directly, and which should be treated as bugs to remove?

## Provisional judgment

Two things can be true at once:

- Restricting captured context by phase is good. Unlimited hydration is exactly the token-overhead problem phase 42.1 just made visible.
- The current restrictions are too coarse and too inheritance-driven. They optimize for file names, not for decision relevance.

The likely better direction is:

- keep phase-scoped hydration
- but make the inputs query-driven
- and prefer relevant decisions plus plan-linked refs over static file-name lists

## Follow-up

This question set should be answered as part of the inherited SDK/workstream review track, not as hidden cleanup inside unrelated phases.

Recommended owner:

- task `35-09` for the SDK/context-engine redesign question

Related references:

- `sdk/src/context-engine.ts`
- `sdk/src/phase-prompt.ts`
- `sdk/src/config.ts`
- decision `gad-160`
- decisions `gad-162` and `gad-163`
- `.planning/notes/upstream-gsd-review-2026-04-12.md`
