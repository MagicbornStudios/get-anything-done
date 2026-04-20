# Skills MCP server — task #8 (decision 2026-04-20)

**Decision:** skip `gad skill query` CLI; expose skills via MCP tools so any
runtime (Claude Code, Codex, Cursor, etc.) can query without depending on
`.claude/skills/` / `.codex/skills/` auto-discovery.

**Shipped 2026-04-20 in `bin/gad-mcp.cjs`:** three new MCP tools alongside the
existing planning tools (gad_snapshot / gad_state / gad_tasks / …).

## Tools

| Tool | Purpose | Input | Output |
|---|---|---|---|
| `gad_skills_list` | Browse available skills with descriptions (summary, low-token) | `{ lane?, search?, include_proto?, limit? }` | `{ count, skills: [{id, name, description, workflow, lane, origin}] }` |
| `gad_skills_find` | Keyword-ranked search for the best-matching skill given a natural-language task | `{ query, limit? }` | `{ query, total, returned, matches: [{id, name, description, workflow, kind, score}] }` |
| `gad_skills_show` | Pull full SKILL.md + linked workflow body for one id | `{ id, include_workflow? }` | `{ id, origin, name, description, workflow, skill_md_body, workflow_body }` |

The pipeline: agent calls `gad_skills_find` with "what I'm trying to do", picks the top match, then calls `gad_skills_show` to load the full skill body into its context on demand. No reliance on runtime auto-discovery → no surprise skills bleeding in from `.claude/skills/` etc.

## Wire-up per runtime

**Claude Code** — add to `~/.claude/mcp.json` or `.claude/settings.json` MCP block:
```json
{
  "mcpServers": {
    "gad": {
      "command": "node",
      "args": ["C:/Users/benja/Documents/custom_portfolio/vendor/get-anything-done/bin/gad-mcp.cjs"]
    }
  }
}
```

**Codex CLI** — add to `~/.codex/config.toml`:
```toml
[mcp_servers.gad]
command = "node"
args = ["C:/Users/benja/Documents/custom_portfolio/vendor/get-anything-done/bin/gad-mcp.cjs"]
```

**Cursor** — add to `~/.cursor/mcp.json` or `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "gad": {
      "command": "node",
      "args": ["C:/Users/benja/Documents/custom_portfolio/vendor/get-anything-done/bin/gad-mcp.cjs"]
    }
  }
}
```

`gad-mcp.cjs` finds the repo root automatically by walking parents for
`.planning/` / `gad-config.toml`. `GAD_SKILLS_DIR` and `GAD_PROTO_SKILLS_DIR`
env vars override the default skill roots.

## Next steps for the operator

1. Add the gad MCP server block to one runtime (Claude Code is the easiest to test — reload the session after edit).
2. In the chat, ask the agent "find me a skill for X" — it will call `gad_skills_find` via MCP.
3. Verify no surprise skills load from `.claude/skills/` — the runtime isn't scanning the folder; the agent is pulling on demand.

The three tools are a complete replacement for the runtime-folder auto-discovery pattern the operator asked to get rid of on 2026-04-19.
