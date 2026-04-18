# Troubleshooting — build-and-release-locally

Detailed debug paths moved out of SKILL.md for token efficiency. Most
operators never read this — only consulted when the specific failure
appears.

## postject: "Multiple occurrences of sentinel found in the binary"

**What's happening.** The SEA sentinel is a magic byte string that must
appear EXACTLY ONCE in the final executable — in the placeholder region
of the Node binary that postject overwrites with our blob.

When postject injects the blob as a PE resource on Windows, the blob's
bytes land in a resource section of the final binary. If the blob itself
contains the sentinel string (because some file in the release-support
tree — a skill, doc, template — literally quotes the sentinel), postject's
post-inject sanity re-scan finds two copies and aborts.

**Debug it.** Find which file embeds the literal:

```sh
node -e "
  const fs = require('fs');
  const b = fs.readFileSync('dist/release/sea-prep-win32-x64.blob');
  const n = Buffer.from('NODE_SEA_FUSE_' + '<hex>');  // replace <hex> with the sentinel fuse hex
  let i = 0;
  while ((i = b.indexOf(n, i)) !== -1) {
    console.log(i, b.slice(Math.max(0, i - 80), i + 60).toString().replace(/[^\x20-\x7e]/g, '.'));
    i++;
  }
"
```

The printed context (±80 bytes) will identify the offending source file.

**Fix.** Either remove the literal or break it with string concatenation
so it doesn't appear as a contiguous byte sequence on disk.

**Incident history.** 2026-04-14 — initially misdiagnosed as a Node
version bug. Confirmed via the debug command above; both hits were in
`skills/build-and-release-locally/SKILL.md` (included twice: once from
`skills/` and once from `dist/release-support/get-anything-done/skills/`).
The skill now only references the sentinel symbolically.

## `esbuild: No loader is configured for ".node" files`

Optional embedding backend (`@huggingface/transformers`) transitively
pulls native `.node` binaries that esbuild can't bundle.

Fix (applied 2026-04-14): add to the esbuild `external` list in
`scripts/build-cli.mjs`:

- `@huggingface/transformers`
- `onnxruntime-node`
- `onnxruntime-common`
- `onnxruntime-web`
- `sharp`

If the failure regresses after a dependency upgrade, re-check that list
against the new `package.json` + `node_modules/@huggingface/transformers/`
to see what new native deps appeared.

The packaged exe runs without embeddings — snapshot falls back to Jaccard
ranking in that state.
