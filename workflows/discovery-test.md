<workflow slug="discovery-test" name="Subagent discovery test battery">

<objective>
Spawn N cold subagents with distinct tasks, restrict their tools to `gad` CLI
+ Read-for-CLI-surfaced-paths, and measure how findable the skill catalog is
to a cold agent. Produces structured JSON findings, a read-chain flow graph,
and a mean confidence regression metric. Output lands in
`.planning/notes/subagent-discovery-findings-<date>.md` (human-readable) and
`site/data/discovery-findings.json` (planning site visualization).

This is the canonical regression test for skill discoverability. Rerun it
after any change to the skill catalog, CLI discovery surface, or the
skill-shape reference docs.
</objective>

<inputs>
  <param name="date" type="string" required="false" default="today">ISO date for the findings file slug</param>
  <param name="agents" type="int" required="false" default="5">How many parallel cold agents to spawn</param>
  <param name="tasks" type="list" required="false">Override the default task list</param>
  <param name="target_confidence" type="float" required="false" default="8.5">Regression threshold — alert if mean confidence drops below this</param>
</inputs>

<outputs>
  <file>.planning/notes/subagent-discovery-findings-&lt;date&gt;.md</file>
  <file>site/data/discovery-findings.json</file>
  <metric name="mean_confidence" type="float"/>
  <metric name="min_confidence" type="float"/>
  <metric name="read_chain_depth_max" type="int"/>
  <metric name="entry_point_count" type="int"/>
</outputs>

<process>

<step id="1" name="gate" tool="gad skill list">
Check for outstanding proto-skills that should be in the catalog first.
If `gad skill list --proto` shows pending proto-skills, warn the operator
and ask whether to run the test against the current catalog or wait.
</step>

<step id="2" name="task-inventory">
Load the default task list. Each task becomes one cold subagent prompt.
The default set covers the five canonical GAD work categories. Override
via the `tasks` parameter if you want to add or replace:

<tasklist>
  <task id="A" name="plan-a-phase">Plan a new phase for this project.</task>
  <task id="B" name="evolution-cycle">Run a complete evolution cycle (find high-pressure phases, draft proto-skills from candidates, validate, promote/discard).</task>
  <task id="C" name="debug-failing-test">A test is failing. Follow the project's systematic debugging methodology.</task>
  <task id="D" name="fresh-session-plus-create-skill">Two sub-tasks: (D1) starting a fresh session, how do you get context? (D2) create a new skill for X.</task>
  <task id="E" name="candidate-to-canonical">Find an existing candidate, draft a proto-skill, test it in the runtime, then promote or discard.</task>
</tasklist>
</step>

<step id="3" name="spawn-agents" tool="Agent (parallel)">
Spawn one `general-purpose` subagent per task, all in a single message so
they run concurrently. Each agent receives the canonical discovery-test
prompt (see &lt;agent-prompt-template&gt; below). Each agent must report a
structured JSON block with:

  - `task`: the task slug
  - `cli_commands_run`: ordered list of gad CLI invocations
  - `skills_discovered`: array of {id, discovered_via, workflow_ref, workflow_read}
  - `read_chain`: array of {depth, path, referenced_paths_followed}
  - `skill_order_for_task`: ordered list of skill ids the agent would use
  - `confidence`: 0-10 integer
  - `missing`: free-text description of gaps

<agent-prompt-template>
You are a GAD discovery test agent. Working directory:
`C:\Users\benja\Documents\custom_portfolio\vendor\get-anything-done`.
You know NOTHING about this project beyond what the `gad` CLI tells you.

STRICT TOOL RESTRICTIONS:
- Bash: ONLY `node bin/gad.cjs <subcommand>` invocations. No grep/find/ls/cat/head/tail/awk/sed.
- Read: ONLY on paths that a prior gad CLI call printed to stdout. Every Read must trace to a CLI-surfaced path.
- NO Glob, Grep, or arbitrary file reads.
- NO reading CLAUDE.md, AGENTS.md, or any file you weren't pointed to.

TASK: {task_description}

Report in the JSON format at the end.
</agent-prompt-template>
</step>

<step id="4" name="aggregate">
Collect the JSON outputs from all spawned agents. Compute:
- `mean_confidence` = average of all agent confidences
- `min_confidence` = worst single agent
- `read_chain_depth_max` = deepest hop any agent traversed
- `entry_point_count` = unique depth-0 paths across all agents
- `unreached_paths` = paths that ≥1 agent needed but couldn't reach

<branch if="mean_confidence &lt; target_confidence">
  Flag a regression. List the gaps found and propose P0/P1 tasks
  to close them. This is the alert contract — rerunning the battery
  after a catalog change and seeing a drop is the regression signal.
</branch>

<else>
  Confidence held. Continue to write-out.
</else>
</step>

<step id="5" name="write-findings" tool="Write">
Write the human-readable findings to
`.planning/notes/subagent-discovery-findings-{date}.md`. Include:

1. Protocol description (restrict-to-CLI, read-chain depth cap)
2. Results summary table (one row per agent)
3. Read-chain flow map (depth 0 entry points → depth ≤3 reads)
4. P0 / P1 / P2 gap classification
5. Testing cadence proposal (when to rerun)
6. Aggregate CLI command frequency
7. Final verdict

Template matches `.planning/notes/subagent-discovery-findings-2026-04-15.md`.
</step>

<step id="6" name="write-site-data" tool="Write">
Emit machine-readable findings for the planning site at
`site/data/discovery-findings.json`. Schema:

```json
{
  "timestamp": "2026-04-15T21:30:00Z",
  "mean_confidence": 7.3,
  "min_confidence": 5,
  "target_confidence": 8.5,
  "regression": false,
  "agents": [
    {
      "task_id": "A",
      "task_name": "plan-a-phase",
      "confidence": 5,
      "cli_commands": [...],
      "skills_discovered": [...],
      "read_chain": [...],
      "gaps": [...]
    }
  ],
  "flow_map": {
    "nodes": [{"id": "path", "depth": 0, "agents_reached": ["A", "B"]}],
    "edges": [{"from": "path_a", "to": "path_b", "via": "workflow:"}]
  },
  "aggregate_cli_frequency": {"gad snapshot": 5, "gad skill list": 5, "..."},
  "unreached_paths": [...]
}
```

The planning site `/planning` route consumes this JSON and renders the flow
map + findings writeup.
</step>

<step id="7" name="commit">
Commit the findings file + site data in one atomic commit:

```bash
git add .planning/notes/subagent-discovery-findings-<date>.md \
        site/data/discovery-findings.json
git commit -m "discovery-test: mean confidence <N>/10 (<date>)"
```
</step>

</process>

<references>
  <ref>references/skill-shape.md §11 — skill lifecycle (what the agents are discovering)</ref>
  <ref>references/skill-shape.md §1a — workflows/ vs .planning/workflows/ distinction</ref>
  <ref>.planning/notes/subagent-discovery-findings-2026-04-15.md — reference template</ref>
  <ref>bin/gad.cjs skillList / skillShow — the CLI surface being tested</ref>
  <ref>decision gad-192 — snapshot EQUIPPED SKILLS section (what agents see first)</ref>
</references>

<notes>
- The battery is ~90 seconds wall-clock per agent (5 agents in parallel → ~90s total).
- Each agent consumes ~50k tokens. 5 agents → ~250k total.
- Mean confidence target is 8.5. Below that, treat as a regression.
- The read-chain flow map data feeds the planning site graphical view (task 42.2-25).
- Retool the agents list to cover new scenarios as the project grows —
  the five canonical tasks are a starting point, not an exhaustive set.
</notes>

</workflow>
