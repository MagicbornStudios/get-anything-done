# Eval Project: cli-efficiency

## Purpose

Measure the token cost of two context-loading workflows for a coding agent resuming work:

**Workflow A — CLI-first (target)**
Run `gad` CLI commands to load project context. Measure bytes/tokens of all CLI output combined.

**Workflow B — Baseline grep+read (control)**  
Use grep, cat, Read tool on planning files directly. Measure bytes/tokens of all file content read.

Then compute: information overlap, unique context per workflow, token reduction ratio, and any context lost by using CLI only.

## Rules

1. Run Workflow A first. Record every `gad` command, its output (bytes), and what context it provides.
2. Run Workflow B second. Record every file read, grep, its output (bytes), and what context it provides.
3. For each unit of information (current phase, current task, roadmap, agent conventions, etc.), mark whether it appears in A, B, or both.
4. Record all measurements in v1/RUN.md and v1/SCORE.md.
5. Append all actions to GAD-TRACE.log using format: `[ISO] EVENT_TYPE target detail`

## Standard artifact set

GAD-TRACE.log, RUN.md, SCORE.md, gad.json, AGENTS.md, REQUIREMENTS.md

## Scoring

- **token_reduction**: (baseline_bytes - cli_bytes) / baseline_bytes
- **context_completeness**: fraction of baseline information units present in CLI output
- **information_loss**: information units present in baseline but NOT in CLI (lower = better)

## What to look for

- CLI commands that return "—" where the file has real data (parser gaps)
- Information only available via raw file read (not surfaced by any gad command)
- CLI commands that return more data than needed (over-fetching)
- Missing CLI commands (gaps that force raw reads)
