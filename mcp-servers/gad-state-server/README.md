# @gad/mcp-state-server

MCP server (stdio) exposing gad team/worker state.

## Tools

| Tool | Description |
|---|---|
| `list_workers` | All workers from `.planning/team/workers/*/status.json` |
| `worker_status(id)` | Single worker detail |
| `dispatcher_status` | Heartbeat + pid + last 20 log lines |
| `account_cooldowns` | `.planning/team/runtime-cooldown.json` |
| `runtime_accounts` | `.planning/team/runtime-accounts.json` (secrets redacted) |

## Usage

```sh
cd mcp-servers/gad-state-server
npm install
node index.js   # waits on stdio for MCP client
```

## Claude Desktop config example

```json
{
  "mcpServers": {
    "gad-state": {
      "command": "node",
      "args": ["/path/to/vendor/get-anything-done/mcp-servers/gad-state-server/index.js"]
    }
  }
}
```

## REDACT pattern

Any key matching `/_KEY|_TOKEN|Authorization|api_key|secret|password/i` is replaced with `[REDACTED]`.
