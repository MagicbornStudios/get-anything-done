# Decentralized Auto-Contributor Model

**Source:** Session 2026-04-16c (decision gad-224)

## Concept

Users contribute AI tokens (their coding agent time) instead of cash.
Their local agent picks features/bugs from a project queue, works on them
locally, submits PRs.

## Requirements

- Feature/bug queue format (published by project maintainer)
- `gad contribute` command — opt-in, pick a task, spawn agent, submit PR
- Hook integration — auto-trigger on schedule or idle
- Contributor credit tracking (who contributed, how many tokens, what features)
- PR review workflow — maintainer reviews agent-submitted PRs
- Private repo access grants
- Public repos work out of the box

## Open questions

- How to scope agent access (read-only vs write, which dirs?)
- Quality gate for agent-submitted PRs (CI must pass? Human review required?)
- Token accounting — how to measure/credit contribution?
- Security: agent runs on user's machine, submits to project repo
- Rate limiting — don't flood a project with low-quality PRs

## Next step

Design the feature queue format. Could be as simple as GitHub issues with a label.
