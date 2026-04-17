# Design doc before phase 57 snapshot rewrite

**Source:** session 2026-04-17 strategy pivot

Per decision gad-241 + phase 57.

Before rewriting the snapshot emitter, produce a design doc that:

1. Enumerates current redundancies with BYTE COUNTS
   - phase 42.4 appearing in both startup + snapshot — how many bytes?
   - <references><reference>...</reference></references> vs bare array — how many bytes per reference saved?
   - Closing tags in general — where do they cost most?

2. Proposes a compact format
   - YAML-like deltas vs JSON-flat vs indented key:value
   - Which sections stay XML (structured content) vs switch (scalar lists)?
   - How does the agent parse the compact format reliably?

3. Measures before/after on the full get-anything-done snapshot

4. Locks in the format and writes failing tests

Write to .planning/notes/snapshot-compaction-design-YYYY-MM-DD.md before writing any code.
