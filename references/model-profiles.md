# Model Profiles

Model profiles control which Claude model each GAD agent uses. They are off by default, and when enabled they balance quality vs token spend or inherit the currently selected session model.

## Profile Definitions

| Agent | `quality` | `balanced` | `budget` | `inherit` |
|-------|-----------|------------|----------|-----------|
| gad-planner | inherit | inherit | sonnet | inherit |
| gad-roadmapper | inherit | inherit | sonnet | inherit |
| gad-executor | inherit | sonnet | haiku | inherit |
| gad-phase-researcher | inherit | sonnet | haiku | inherit |
| gad-project-researcher | inherit | sonnet | haiku | inherit |
| gad-research-synthesizer | inherit | sonnet | haiku | inherit |
| gad-debugger | inherit | inherit | sonnet | inherit |
| gad-codebase-mapper | sonnet | haiku | haiku | inherit |
| gad-verifier | inherit | sonnet | haiku | inherit |
| gad-plan-checker | inherit | sonnet | haiku | inherit |
| gad-integration-checker | inherit | sonnet | haiku | inherit |
| gad-nyquist-auditor | inherit | sonnet | haiku | inherit |

## Profile Philosophy

**quality** - Maximum reasoning power
- Opus for all decision-making agents
- Sonnet for read-only verification
- Use when: quota available, critical architecture work

**balanced** - Smart allocation
- Inherit for Opus-tier planning/debugging agents
- Sonnet for execution, research, and verification
- Haiku for mapping
- Use when: normal development, good balance of quality and cost

**budget** - Minimal expensive-model usage
- Sonnet only for the heaviest planning/debug roles
- Haiku for most execution, research, and verification
- Use when: conserving quota, high-volume work, less critical phases

**inherit** - Follow the current session model
- All agents resolve to `inherit`
- Best when you switch models interactively (for example OpenCode `/model`)
- **Required when using non-Anthropic providers** (OpenRouter, local models, etc.) — otherwise GSD may call Anthropic models directly, incurring unexpected costs
- Use when: you want GSD to follow your currently selected runtime model

## Using Non-Claude Runtimes (Codex, OpenCode, Gemini CLI)

When installed for a non-Claude runtime, GAD should omit model selection by default so each agent uses the runtime's default model. No manual setup is needed.

To assign different models to different agents, add `model_overrides` with model IDs your runtime recognizes:

```json
{
  "resolve_model_ids": "omit",
  "model_overrides": {
    "gsd-planner": "o3",
    "gsd-executor": "o4-mini",
    "gsd-debugger": "o3",
    "gsd-codebase-mapper": "o4-mini"
  }
}
```

The same tiering logic applies: stronger models for planning and debugging, cheaper models for execution and mapping.

## Using Claude Code with Non-Anthropic Providers (OpenRouter, Local)

If you're using Claude Code with OpenRouter, a local model, or any non-Anthropic provider, set the `inherit` profile to prevent GAD from calling Anthropic models for subagents:

```bash
# Via settings command
/gsd:settings
# → Select "Inherit" for model profile

# Or manually in .planning/config.json
{
  "model_profile": "inherit"
}
```

Without `inherit`, an enabled GAD profile spawns specific Anthropic model aliases (`opus`, `sonnet`, `haiku`) for each agent type, which can result in additional API costs through your non-Anthropic provider.

## Resolution Logic

Orchestrators resolve model before spawning:

```
1. Read .planning/config.json
2. Check model_overrides for agent-specific override
3. If no override, look up agent in profile table
4. Pass model parameter to Task call
```

## Per-Agent Overrides

Override specific agents without changing the entire profile:

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gad-executor": "opus",
    "gad-planner": "haiku"
  }
}
```

Overrides take precedence over the profile. Valid values: `opus`, `sonnet`, `haiku`, `inherit`, or any fully-qualified model ID (e.g., `"o3"`, `"openai/o3"`, `"google/gemini-2.5-pro"`).

## Switching Profiles

Runtime: `gad config set-model-profile <profile>` or the runtime-specific command wrapper

Per-project default: Set in `.planning/config.json`:
```json
{
  "model_profile": "off"
}
```

## Design Rationale

**Why `inherit` for Opus-tier agents?**
Planning involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why Sonnet for `gad-executor` in balanced?**
Executors follow explicit PLAN.md instructions. The plan already contains the reasoning; execution is implementation.

**Why Sonnet (not Haiku) for verifiers in balanced?**
Verification requires goal-backward reasoning - checking if code *delivers* what the phase promised, not just pattern matching. Sonnet handles this well; Haiku may miss subtle gaps.

**Why Haiku for `gad-codebase-mapper`?**
Read-only exploration and pattern extraction. No reasoning required, just structured output from file contents.

**Why Claude aliases instead of frozen model IDs?**
Claude Code resolves aliases like `"sonnet"`, `"haiku"`, and `"opus"` to currently available versions. This avoids stale hardcoded IDs and makes model switching observable through `session_init.model`.

**Why `inherit` profile?**
Some runtimes (including OpenCode) let users switch models at runtime (`/model`). The `inherit` profile keeps all GSD subagents aligned to that live selection.
