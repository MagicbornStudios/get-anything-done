# Subagent tip-author contract must reindex teachings/index.json

**Source:** 2026-04-17 session 4 — teachings reader discovered stale index

The llm-from-scratch daily subagent wrote vendor/get-anything-done/teachings/static/llm-internals/04-src-layout-vs-install.md and committed it, but did NOT run 'gad tip reindex' afterward. Result: the new tip was on disk and in the catalog bundle but not in index.json, so /teachings/&lt;slug&gt; returned 404 for that slug until manually reindexed. Fix: add a 'reindex after write' step to the subagent report contract in decision gad-258 (or wherever the llm-from-scratch subagent prompt template lives once it's formalized). Alternative: make 'gad tip reindex' automatic via a git pre-commit hook that detects changes under teachings/static/. Prefer explicit reindex — hooks are invisible to agents reading the contract.
