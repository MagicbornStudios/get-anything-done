# Stray git tree at `tmp/openai-codex/`

**Surfaced by:** `46-15` submodule audit, 2026-04-18.

`tmp/openai-codex/` holds the `openai/codex` Rust CLI checked out as a real
git repo (HEAD `ea34c6e8` — `fix: fix clippy issue in examples/ folder`,
2026-04-16). It is **not** registered in `.gitmodules`, so
`git submodule status` exits non-zero with:

```
fatal: no submodule mapping found in .gitmodules for path 'tmp/openai-codex'
```

This breaks `git submodule status` / `--recursive` for downstream tooling.

## Options (pick one)

1. **Delete it.** `rm -rf tmp/openai-codex/` — recommended unless someone is
   actively bisecting upstream codex.
2. **Promote to a vendor submodule.** Move to `vendor/openai-codex` and add
   a `[submodule "vendor/openai-codex"]` block in `.gitmodules`. Joins the
   existing `vendor:*` convention; gets cleaned by `gad health prune` once
   it goes stale.
3. **Move to `.gitignore`.** If it must live at `tmp/`, add `/tmp/` to
   `.gitignore` so the working-tree noise stops surfacing in `git status`.

Operator decision needed before action — leaving the audit as advisory.

## Acceptance

- [ ] `git submodule status` (no `--recursive`) exits 0 with no `fatal:` lines
- [ ] Either `tmp/openai-codex/` is gone, or it is registered, or it is
      ignored — but not all-three-at-once
