# Workflow: GAD CLI Over File Foraging

## Inputs
- A question about the GAD ecosystem state (decisions, handoffs, errors, architecture, history, phases, tasks)

## Steps
1. **Before reaching for Glob/Read/Grep**: ask — does a `gad` subcommand answer this?
   - Decisions: `gad decisions list --projectid <id>` or `gad decisions show <id>`
   - Tasks: `gad tasks list --projectid <id> --phase <n>`
   - Errors: `gad errors --projectid <id>`
   - Handoffs: `gad handoffs list --projectid <id>`
   - Phases: `gad phases list --projectid <id>`
   - Full state: `gad snapshot --projectid <id>`
   - General knowledge: `gad ask "<question>" --projectid <id>` (MoE routing)
2. If the answer is yes — use the CLI, not file foraging.
3. Only reach for Glob+Read+Grep when: (a) the CLI doesn't cover it, (b) you need file content for editing, (c) you're looking for code patterns not planning data.
4. **Never read raw XML planning files directly** when a CLI command surfaces the same data parsed and formatted.

## Verification
- Session tool-call log shows `gad <subcommand>` before any Glob/Read on `.planning/` files
- Questions about task status, decision history, or error records answered via CLI output, not raw file reads

## Failure modes
- **Habit of Glob+Grep on .planning/**: slow, context-consuming, bypasses CLI parsing.
- **`gad ask` not tried for general questions**: MoE routing is cheaper than manual multi-file synthesis.
- **Reading TASK-REGISTRY.xml directly**: use `gad tasks list` — same data, structured output, less tokens.
