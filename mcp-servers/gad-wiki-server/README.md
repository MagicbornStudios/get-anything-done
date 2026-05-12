# gad-wiki-server

MCP stdio server exposing fast cross-document search over the monorepo's
markdown knowledge surfaces.

## Sources indexed

| Source key | Path | Notes |
|---|---|---|
| `notes` | `<repo>/.planning/notes/**/*.md` | Recursive. Primary planning-note surface. |
| `docs` | `<repo>/docs/**/*.{md,mdx}` | Compile sink; read-only. Indexed when present. |
| `gad-notes` | `<repo>/vendor/get-anything-done/.planning/notes/**/*.md` | Submodule notes (different planning root). |

Files with extensions other than `.md` / `.mdx` / `.txt` are ignored.
`node_modules`, `dist`, `.git`, `.next`, `target`, `bundle`, `dist-bundle`
are skipped. Files > 1 MB are read but truncated at 1 MB.

Repo root is resolved with the same walker as `gad-state-server`
(`pnpm-workspace.yaml` or `.planning/` sentinel).

## Tools

### `search`

Input: `{ query: string, limit?: number }` (limit default 20, max 200).

Substring case-insensitive scoring. Query is whitespace-split into terms;
each term contributes `TF * log(1 + N / (1 + DF))` to the document score.
Results are sorted by descending score. Snippet is centered on the longest
query term.

Output: array of `{ path, source, snippet, score }` where `source` is
one of `notes` / `docs` / `gad-notes` and `path` is repo-relative.

### `get_doc`

Input: `{ path: string }` (absolute or repo-relative).

Path-traversal protected: rejects paths that don't resolve under one of
the allowed source roots above. Also rejects extensions outside the
allowed set.

Output: `{ path, content, mtime, source }`. Files larger than 1 MB get
their content truncated with a trailing `... [truncated]` marker.

### `list_topics`

Input: `{}`.

Heuristic bucketing:

- `notes` / `gad-notes` → grouped by `YYYY-MM` filename prefix when the
  filename matches; nested files fall back to first sub-dir; otherwise
  `_misc`.
- `docs` → grouped by first path segment under `docs/`; root-level docs
  bucket as `_root`.

Output: array of `{ topic, count }`, sorted by descending count.

## Index strategy

Lazy and cached in-process. First call walks all source dirs and builds
an array of `{ path, source, mtime, size, contentLower, content }`.
Subsequent calls within 60 s reuse the in-memory index; on TTL expiry the
next call rebuilds. No file watchers (avoids Windows `fs.watch` landmines).

## Run

```sh
node index.js
```

Stdio transport. Pipe MCP framed messages on stdin, read responses from
stdout, stderr is human-readable diagnostics only.

## Smoke

```sh
cd vendor/get-anything-done/mcp-servers/gad-wiki-server
node index.js
```

then pipe a `tools/list` followed by a `tools/call` for `search`.
