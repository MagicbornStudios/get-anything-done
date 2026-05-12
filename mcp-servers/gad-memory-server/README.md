# gad-memory-server

MCP server (stdio) exposing two memory surfaces read-only to MCP clients:

1. **Project notes** — every `.md` under `<repo-root>/.planning/notes/` discovered
   via the standard `findRepoRoot()` walker (looks for `pnpm-workspace.yaml`
   or `.planning/`).
2. **Claude auto-memory** — every `.md` under
   `~/.claude/projects/<repo-slug>/memory/` where `<repo-slug>` mirrors how
   Claude Code derives the directory name (replace `:` and path separators
   in the absolute repo path with `-`).

Sibling to `gad-state-server` and `gad-trace-server`; same `@modelcontextprotocol/sdk`
pin (1.29.0), same `findRepoRoot()` walker, same redact pattern.

## Tools

| Tool | Input | Output |
|---|---|---|
| `list_notes` | `{ glob?: string }` — optional case-insensitive substring filter on filename | `[{ path, mtime, sizeBytes, title }]` (title = first H1) |
| `search_notes` | `{ query: string, limit?: number }` (limit default 20) | `[{ path, snippet, score }]` — snippet = 200 chars around first match, score = match count |
| `get_note` | `{ path: string }` — accepts relative-to-notes-dir or absolute inside notes dir; `.md` suffix optional | `{ path, content, mtime }` |
| `list_memories` | `{}` | `[{ slug, mtime, sizeBytes, description }]` (description from YAML frontmatter when present) |
| `get_memory` | `{ slug: string }` — slug with or without `.md` | `{ slug, content, frontmatter, mtime }` |

## Security

- **Read-only.** No write/delete/rename tools.
- **Path-escape guard.** `get_note` and `get_memory` resolve their candidate
  path then verify it lives inside the allowed directory before opening.
  Out-of-tree paths are rejected with `isError: true`.
- **Inline redaction.** Note bodies and snippets pass through a regex sweep
  that scrubs bearer tokens, JWTs, `sk-…` keys, and `ghp_…` tokens.
- **Frontmatter redaction.** Parsed memory frontmatter passes through the
  same `redactObj` helper as `gad-state-server` so keys matching
  `_KEY|_TOKEN|Authorization|api_key|secret|password` are replaced with
  `[REDACTED]`.

## Run

```sh
cd mcp-servers/gad-memory-server
npm install
node index.js
# stdio JSON-RPC server — wire from your MCP client config
```

## Smoke

Quick `tools/list` from a separate shell:

```sh
node -e "import('@modelcontextprotocol/sdk/client/index.js').then(async ({ Client }) => {
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const t = new StdioClientTransport({ command: 'node', args: ['index.js'] });
  const c = new Client({ name: 'smoke', version: '0.0.1' }, { capabilities: {} });
  await c.connect(t);
  console.log(await c.listTools());
  await c.close();
})"
```
