# Model Profile Resolution

Resolve model profile once at the start of orchestration, then use it for all Task spawns.

## Resolution Pattern

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "off")
```

Default: `off` if not set or config missing.

## Lookup Table

@references/model-profiles.md

Look up the agent in the table for the resolved profile. Pass the model parameter to Task calls:

```
Task(
  prompt="...",
  subagent_type="gad-planner",
  model="{resolved_model}"  # "inherit", "sonnet", "haiku", or omitted when off
)
```

**Note:** `off` means omit the `model` parameter entirely. Enabled profiles resolve to Claude aliases rather than frozen model IDs so the runtime can select a current compatible version.

If `model_profile` is `"inherit"`, all agents resolve to `"inherit"` (useful for OpenCode `/model`).

## Usage

1. Resolve once at orchestration start
2. Store the profile value
3. Look up each agent's model from the table when spawning
4. Pass model parameter to each Task call (values: `"inherit"`, `"sonnet"`, `"haiku"`)
