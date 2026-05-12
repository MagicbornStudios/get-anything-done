# @gad/mcp-trace-server

MCP server (stdio) exposing gad invocation logs and trace events.

## Tools

| Tool | Description |
|---|---|
| `recent_invocations(limit?=50)` | Today's `.gad-log/<date>.jsonl`, newest-first |
| `runtime_usage_today` | Invocation counts by runtime for today |
| `codex_calls_since(iso_ts)` | codex-cli calls after timestamp |
| `spend_summary(days?=1)` | Aggregate `ai-spend-ledger` over N days |
| `trace_events(limit?=100)` | Tail `.planning/.trace-events.jsonl` |

## Usage

```sh
cd mcp-servers/gad-trace-server
npm install
node index.js   # waits on stdio for MCP client
```

## Claude Desktop config example

```json
{
  "mcpServers": {
    "gad-trace": {
      "command": "node",
      "args": ["/path/to/vendor/get-anything-done/mcp-servers/gad-trace-server/index.js"]
    }
  }
}
```

## REDACT pattern

Any key matching `/_KEY|_TOKEN|Authorization|api_key|secret|password/i` is replaced with `[REDACTED]`.
