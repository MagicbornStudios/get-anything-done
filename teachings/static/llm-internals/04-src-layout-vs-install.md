---
id: llm-internals-src-layout-01
title: Src layout without self-install
category: llm-internals
difficulty: beginner
tags: [python, packaging, pyproject, pytest, namespace]
source: static
date: 2026-04-17
implementation: projects/llm-from-scratch/pyproject.toml
decisions: llm-002
phases: llm-from-scratch:01
related: llm-internals-tokens-01
---

# Src layout without self-install

A from-scratch LLM project is a **learning vehicle**, not a library someone installs. You want every edit in `src/` to take effect on the next `pytest` run with zero ceremony — no `pip install -e .`, no wheel, no rebuild step.

## The two-line fix

In `pyproject.toml`:

```toml
[tool.pytest.ini_options]
pythonpath = ["src"]
```

And a one-line `conftest.py` at the repo root that does the same thing for plain `python -m` invocations:

```python
import sys
sys.path.insert(0, "src")
```

That's it. `from tokenizer import bpe_train` now works. Packages under `src/` are **namespace packages** (empty `__init__.py`) — Python finds them via the path entry alone.

## Why not `pip install -e .`?

Editable installs work, but they add a hidden step: a forgotten `pip install` means imports silently run **stale code**. On a hand-rolled project where you're validating gradients numerically, that's a debugging nightmare. The `pythonpath` entry eliminates the install state entirely — the source tree IS the import tree.

## Takeaway

For research code, prefer `pythonpath = ["src"]` over self-install. One fewer state to track, faster iteration, identical test ergonomics.
